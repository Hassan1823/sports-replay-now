import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure temp directory exists
const tempDir = "./public/temp";
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, tempDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `video-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    "video/mp4",
    "video/webm",
    "video/ogg",
    "video/quicktime",
    "video/x-msvideo", // avi
    "video/x-matroska", // mkv
  ];

  const ext = path.extname(file.originalname).toLowerCase().substring(1);
  const allowedExts = ["mp4", "mov", "avi", "mkv", "webm"];

  if (allowedTypes.includes(file.mimetype) && allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(
      new Error(`Invalid file type. Allowed types: ${allowedExts.join(", ")}`),
      false
    );
  }
};

// no limit to the number of files
export const upload = multer({
  storage,
  limits: {
    fileSize: 1024 * 1024 * 1024 * 2, // 2GB limit
    files: 100,
    // No 'files' property means no file count limit
  },
  fileFilter,
});

// * if we want to set a limit on the number of files
// export const upload = multer({
//   storage,
//   limits: {
//     fileSize: 1024 * 1024 * 1024 * 2, // 2GB limit
//     files: 100, // Allow multiple files
//   },
//   fileFilter,
// });

// For single file upload
export const singleUpload = upload.single("videoFile");

// For multiple file uploads (no limit)
export const multipleUpload = upload.array("videoFiles", 100);

// * optional if we want to set limit of uploading files
// export const multipleUpload = upload.array("videoFiles", 100);
