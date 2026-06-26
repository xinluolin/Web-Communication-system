package com.im.sys.controller;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/upload")
public class FileUploadController {

    private static final Logger logger = LoggerFactory.getLogger(FileUploadController.class);

    private static final String UPLOAD_BASE = System.getProperty("user.dir") + File.separator + "uploads";

    @PostMapping("/image")
    public ResponseEntity<Map<String, Object>> uploadImage(@RequestParam("file") MultipartFile file) {
        return doUpload(file, "images", "image", "Image", 10 * 1024 * 1024);
    }

    @PostMapping("/video")
    public ResponseEntity<Map<String, Object>> uploadVideo(@RequestParam("file") MultipartFile file) {
        return doUpload(file, "videos", "video", "Video", 50 * 1024 * 1024);
    }

    private ResponseEntity<Map<String, Object>> doUpload(MultipartFile file, String subDir,
                                                          String typePrefix, String typeLabel, long maxSize) {
        Map<String, Object> result = new HashMap<>();

        if (file.isEmpty()) {
            result.put("success", false);
            result.put("message", "File is empty");
            return ResponseEntity.badRequest().body(result);
        }

        String contentType = file.getContentType();
        if (contentType == null || !contentType.startsWith(typePrefix + "/")) {
            result.put("success", false);
            result.put("message", "Only " + typeLabel.toLowerCase() + " files are allowed");
            return ResponseEntity.badRequest().body(result);
        }

        if (file.getSize() > maxSize) {
            result.put("success", false);
            result.put("message", typeLabel + " size cannot exceed " + (maxSize / 1024 / 1024) + "MB");
            return ResponseEntity.badRequest().body(result);
        }

        try {
            String dateDir = LocalDate.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd"));
            Path uploadPath = Paths.get(UPLOAD_BASE, subDir, dateDir);
            Files.createDirectories(uploadPath);

            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            String newFilename = UUID.randomUUID().toString() + extension;

            Path filePath = uploadPath.resolve(newFilename);
            file.transferTo(filePath.toFile());

            String fileUrl = "/uploads/" + subDir + "/" + dateDir + "/" + newFilename;

            result.put("success", true);
            result.put("url", fileUrl);
            result.put("fileName", originalFilename);
            result.put("fileSize", file.getSize());
            logger.info("{} upload success: {} -> {}", typeLabel, originalFilename, fileUrl);

            return ResponseEntity.ok(result);
        } catch (IOException e) {
            logger.error(typeLabel + " upload failed", e);
            result.put("success", false);
            result.put("message", typeLabel + " upload failed: " + e.getMessage());
            return ResponseEntity.internalServerError().body(result);
        }
    }
}
