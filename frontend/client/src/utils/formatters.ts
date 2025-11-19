export const formatNumberWithPrecision = (value: any, precision: number = 2): string => {
  const num = Number(value); // मान को संख्या में बदलने का प्रयास करें
  if (typeof num === 'number' && !isNaN(num)) {
    return num.toFixed(precision);
  }
  return ''; // यदि यह संख्या नहीं है तो खाली स्ट्रिंग लौटाएं
};
