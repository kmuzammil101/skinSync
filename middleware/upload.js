import multer from "multer";

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype && file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed"));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const imageUpload = {
  single: (fieldName = "image") => upload.single(fieldName),
  multiple: (fieldName = "images", maxCount = 10) =>
    upload.array(fieldName, maxCount),
  none: () => upload.none(),
};

export default upload;
