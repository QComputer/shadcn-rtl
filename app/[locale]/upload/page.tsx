"use client";
import { Button } from "@/components/ui/button";
import React, { useEffect, useState } from "react";

interface ImageRecord {
  id: number;
  url: string;
  filename: string;
}

export default function Home() {
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [progress, setProgress] = useState<number>(0);

  // Fetch existing images
  useEffect(() => {
    fetch("/api/images")
      .then((res) => res.json())
      .then((data) => setImages(data))
      .catch(err => console.error("Failed to fetch images:", err));
  }, []);

  // Upload function
  async function uploadFile(file: File) {
    const form = new FormData();
    form.append("file", file);

    return new Promise<ImageRecord>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/upload");

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
      };

      xhr.onload = () => {
        setProgress(0);
        resolve(JSON.parse(xhr.responseText));
      };

      xhr.onerror = reject;
      xhr.send(form);
    });
  }
  // Handle file selection 
  const handleSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const img = await uploadFile(file);
      setImages((prev) => [img, ...prev]);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    }
    e.target.value = ""; // Reset file input to allow uploading the same file again
  };

  // Handle file drop (remains mostly the same, but gets ImageRecord)
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    try {
      const img = await uploadFile(file);
      setImages((prev) => [img, ...prev]);
    } catch (error) {
      console.error("Upload failed:", error);
      alert("Upload failed. Please try again.");
    }
  };


  // Delete Image function
  const handleDelete = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this image?")) return;

    try {
      const response = await fetch(`/api/images/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete image");
      }

      // Remove image from state
      setImages((prev) => prev.filter((img) => img.id !== id));
      alert("Image deleted successfully!");
    } catch (error: any) {
      console.error("Deletion failed:", error);
      alert(`Deletion failed: ${error.message}`);
    }
  };

  const prevent = (e: React.DragEvent) => e.preventDefault();

  return (
    <div className="p-10 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Persistent Image Gallery</h1>

      {/* Upload Area */}
      <div
        onDragOver={prevent}
        onDragEnter={() => setIsDragging(true)}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition ${
          isDragging ? "bg-blue-100 border-blue-500" : "bg-gray-50 border-gray-300"
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
            className="h-full bg-blue-600 transition-all"
          />
        </div>
      )}

      {/* Gallery */}
      <div className="grid grid-cols-3 gap-4 mt-8">
        {images.map((img) => (
          <div key={img.id} className="relative group">
            <img
              src={img.url}
              alt={img.filename}
              className="rounded-lg shadow object-cover w-full h-32"
            />
            <Button
              onClick={() => handleDelete(img.id)}
              aria-label="Delete image"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
