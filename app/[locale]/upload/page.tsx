"use client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import React, { useEffect, useState } from "react";

interface ImageRecord {
  id: string;
  url: string; // This will now be like "/uploads/1678886400000-myimage.jpg"
  filename: string;
}

export default function ImageUploadPage() { // Renamed component for clarity
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  // Fetch existing images
  useEffect(() => {
    fetch("/api/images")
      .then((res) => {
        if (!res.ok) {
          throw new Error(`HTTP error! status: ${res.status}`);
        }
        return res.json();
      })
      .then((data) => setImages(data))
      .catch(err => console.error("Failed to fetch images:", err));
  }, []);

  // Upload function using XMLHttpRequest for progress
  async function uploadFile(file: File): Promise<ImageRecord> {
    const form = new FormData();
    form.append("file", file);

    return new Promise<ImageRecord>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload"); // Your upload API endpoint

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };

      xhr.onload = () => {
        setProgress(0); // Reset progress on load
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            resolve(JSON.parse(xhr.responseText));
          } catch (e) {
            reject(new Error("Failed to parse upload response"));
          }
        } else {
          reject(new Error(`Upload failed with status ${xhr.status}: ${xhr.responseText}`));
        }
      };

      xhr.onerror = () => {
        setProgress(0); // Reset progress on error
        reject(new Error("Network error during upload"));
      };

      xhr.send(form);
    });
  }

  // Handle file selection from input
  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const uploadedImageRecord = await uploadFile(file);
      setImages((prev) => [uploadedImageRecord, ...prev]);
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
    }
    e.target.value = ""; // Reset file input to allow uploading the same file again
  };

  // Handle file drop
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      const uploadedImageRecord = await uploadFile(file);
      setImages((prev) => [uploadedImageRecord, ...prev]);
    } catch (error: any) {
      console.error("Upload failed:", error);
      alert(`Upload failed: ${error.message}`);
    }
  };

  // Delete Image function
  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(`/api/images/${id}`, { // Your DELETE API endpoint
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Failed to delete image (Status: ${response.status})`);
      }

      // Remove image from state upon successful deletion
      setImages((prev) => prev.filter((img) => img.id !== id));
      alert("Image deleted successfully!");
    } catch (error: any) {
      console.error("Deletion failed:", error);
      alert(`Deletion failed: ${error.message}`);
    }
  };

  // Helper to prevent default drag behavior
  const preventDefaults = (e: React.DragEvent) => e.preventDefault();

  return (
    <Card className="p-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Persistent Image Gallery</h1>
<CardTitle>
      {/* Upload Area */}
      <div
        onDragOver={preventDefaults}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
          isDragging ? "bg-blue-500 border-yellow-500 " : ""
        }`}
      >
        <input
          id="fileInput"
          type="file"
          className="hidden"
          onChange={handleSelect}
          accept="image/*"
        />
        <label htmlFor="fileInput" className="text-lg cursor-pointer">
          {isDragging ? "Drop to upload…" : "Drag & drop or click to upload"}
        </label>
      </div>

      {/* Progress Bar */}
      {progress > 0 && (
        <div className="mt-4 h-3 w-full bg-gray-200 rounded-full">
          <div
            style={{ width: `${progress}%` }}
            className="h-3 bg-blue-600 rounded-full transition-all duration-300" // Added rounded-full and duration for smoother animation
          />
        </div>
      )}
</CardTitle>
      {/* Gallery */}

<CardContent>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 mt-8"> {/* Responsive grid */}
        {images.map((img) => (
          <div key={img.id} className="relative group">
            {/* Image Display */}
            <img
              // The src now correctly points to your custom file server route
              src={img.url}
              alt={img.filename}
              className="rounded-lg shadow object-cover w-32 h-32"
              loading="lazy" // Added lazy loading for performance
            />
            {/* Delete Button */}
            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <Button
                onClick={() => handleDelete(img.id)}
                aria-label="Delete image"
                size="lg" // Smaller button for icons
                variant="destructive" // Use a destructive variant for delete actions
              >X
              </Button>
            </div>
          </div>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}
