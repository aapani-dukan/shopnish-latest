import { Response } from "express";

export function parseIntParam(
  raw: string,
  label: string,
  res: Response
): number | null {
  const num = parseInt(raw, 10);
  if (Number.isNaN(num)) {
    res.status(400).json({ message: `Invalid ${label}.` });
    return null;
  }
  return num;
}
