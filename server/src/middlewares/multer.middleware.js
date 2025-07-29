import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./public/temp"); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(
      null,
      file.fieldname + "-" + uniqueSuffix + path.extname(file.originalname)
    );
  },
});

// Create the multer instance
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1GB limit
  },
  fileFilter: function (req, file, cb) {
    const filetypes = /mp4|mov|avi|mkv|webm/;
    const mimetype = filetypes.test(file.mimetype);
    const extname = filetypes.test(
      path.extname(file.originalname).toLowerCase()
    );

    if (mimetype && extname) {
      return cb(null, true);
    }
    cb(new Error("Only video files are allowed (mp4, mov, avi, mkv, webm)"));
  },
});

// Export the configured multer instance
export { upload };
