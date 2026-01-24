import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { homeLayout } from '../../shared/backend/schema'; 
import { eq, asc, and, or, sql } from 'drizzle-orm'; // ✅ sql, and, or add kiya
import { uploadImage } from '../cloudStorage';
import fs from 'fs';

// ==========================================
// 1. Admin: Add New Home Layout Section
// ==========================================
export const addHomeElement = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { sectionName, displayName, sectionType, priority, isActive, linkTo, title, pincodes } = req.body;
    let uploadedImageUrl = '';

    // Image Upload Logic
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        uploadedImageUrl = await uploadImage(fileBuffer, req.file.originalname, req.file.mimetype);
        fs.unlinkSync(req.file.path); 
      } catch (uploadErr) {
        return res.status(500).json({ message: "Image upload failed." });
      }
    }

    // ✅ Pincodes parsing logic
    // Frontend se stringified array aa raha hai: '["323001"]'
    let parsedPincodes: string[] = [];
    if (pincodes) {
      try {
        parsedPincodes = JSON.parse(pincodes);
      } catch (e) {
        parsedPincodes = []; // Agar parsing fail ho toh khali rakhein
      }
    }

    const configData = {
      items: [
        {
          title: title || displayName || '',
          image: uploadedImageUrl,
          deeplink: linkTo || ''
        }
      ]
    };

    // Database Insert
    const [newElement] = await db.insert(homeLayout).values({
      sectionName: sectionName || `Section_${Date.now()}`, 
      displayName: displayName || "New Promotion",
      sectionType: sectionType || 'HERO_BANNER', 
      pincodes: parsedPincodes, // ✅ Naya Column yahan save ho raha hai
      priority: Number(priority) || 0,
      isActive: isActive === 'true' || isActive === true,
      config: configData, 
      createdAt: new Date(),
      updatedAt: new Date(),
    }).returning();

    res.status(201).json({ 
      message: "Home layout section created successfully!", 
      data: newElement 
    });
  } catch (error) { 
    next(error); 
  }
};

// ==========================================
// 2. Public: Get App Home Layout (Filtered by Pincode)
// ==========================================
export const getHomeLayout = async (req: any, res: Response, next: NextFunction) => {
  try {
    const { pincode } = req.query;

    const rawSections = await db
      .select()
      .from(homeLayout)
      .where(
        and(
          eq(homeLayout.isActive, true),
          or(
            sql`cardinality(${homeLayout.pincodes}) = 0`,
            pincode ? sql`${homeLayout.pincodes} @> ARRAY[${pincode}]::text[]` : sql`false`
          )
        )
      )
      .orderBy(asc(homeLayout.priority));

    // ✅ ग्रुपिंग लॉजिक: एक ही टाइप के बैनर्स को एक साथ जोड़ें
    const grouped = rawSections.reduce((acc: any[], section: any) => {
      const existingSection = acc.find(s => s.sectionType === section.sectionType);
      
      if (existingSection && ["HERO_BANNER", "flash_sale", "category_special"].includes(section.sectionType)) {
        // अगर ये बैनर टाइप है, तो इसके आइटम्स को पुराने वाले में जोड़ दो
        existingSection.items = [...existingSection.items, ...section.config.items];
      } else {
        // नया सेक्शन बनाएँ
        acc.push({
          ...section,
          items: section.config.items || []
        });
      }
      return acc;
    }, []);

    res.status(200).json(grouped);
  } catch (error) { 
    next(error); 
  }
};