import { Request, Response, NextFunction } from 'express';
import { db } from '../db';
import { homeLayout } from '../../shared/backend/schema'; 
import { eq, asc } from 'drizzle-orm';
import { uploadImage } from '../cloudStorage';
import fs from 'fs';

// ==========================================
// 1. Admin: Add New Home Layout Section
// ==========================================
export const addHomeElement = async (req: any, res: Response, next: NextFunction) => {
  try {
    // Admin validation ke liye agar zaroorat pade
    const adminId = req.user?.id; 

    const { sectionName, displayName, sectionType, priority, isActive, linkTo, title } = req.body;
    let uploadedImageUrl = '';

    // Image Upload Logic
    if (req.file) {
      try {
        const fileBuffer = fs.readFileSync(req.file.path);
        uploadedImageUrl = await uploadImage(fileBuffer, req.file.originalname, req.file.mimetype);
        fs.unlinkSync(req.file.path); // Temp file saaf karein
      } catch (uploadErr) {
        console.error("❌ Image Upload Error:", uploadErr);
        return res.status(500).json({ message: "Image upload failed." });
      }
    }

    // Aapka Schema 'config' JSON mang raha hai
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
      sectionName: sectionName,
      displayName: displayName || null,
      sectionType: sectionType, // e.g., 'HERO_BANNER', 'PROMO_AD'
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
    console.error("❌ Layout Insert Error:", error);
    next(error); 
  }
};

// ==========================================
// 2. Public: Get App Home Layout
// ==========================================
export const getHomeLayout = async (req: any, res: Response, next: NextFunction) => {
  try {
    // db.select use kar rahe hain taaki 'Property homeLayout does not exist' error na aaye
    const sections = await db
      .select()
      .from(homeLayout)
      .where(eq(homeLayout.isActive, true))
      .orderBy(asc(homeLayout.priority));

    console.log(`✅ Fetched ${sections.length} layout sections.`);
    res.status(200).json(sections);
  } catch (error) { 
    console.error("❌ Fetch Layout Error:", error);
    next(error); 
  }
};