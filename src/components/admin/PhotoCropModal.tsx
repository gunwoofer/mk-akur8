"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";

interface Props {
  file: File;
  onConfirm: (blob: Blob) => void;
  onCancel: () => void;
}

export default function PhotoCropModal({ file, onConfirm, onCancel }: Props) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  function handleConfirm() {
    if (!objectUrl) return;
    setProcessing(true);
    const img = new window.Image();
    img.onload = () => {
      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      const canvas = document.createElement("canvas");
      canvas.width = 400;
      canvas.height = 400;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 400, 400);
      canvas.toBlob(
        (blob) => {
          setProcessing(false);
          if (blob) onConfirm(blob);
        },
        "image/jpeg",
        0.85
      );
    };
    img.src = objectUrl;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center p-4"
      onClick={onCancel}
    >
      <div className="absolute inset-0 bg-black/80" />
      <motion.div
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 35 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 space-y-5"
      >
        <p className="text-white font-semibold text-center text-sm">Preview</p>

        {objectUrl && (
          <div className="flex justify-center">
            <div className="w-32 h-32 rounded-full overflow-hidden border-2 border-[#2a2a2a] bg-[#1a1a1a]">
              <img src={objectUrl} alt="preview" className="w-full h-full object-cover" />
            </div>
          </div>
        )}

        <p className="text-gray-600 text-xs text-center">
          Automatically cropped to a circle from the center
        </p>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl border border-[#2a2a2a] text-gray-400 text-sm font-medium"
          >
            Cancel
          </button>
          <motion.button
            onClick={handleConfirm}
            disabled={processing || !objectUrl}
            whileTap={{ scale: 0.97 }}
            className="flex-1 py-3 rounded-xl bg-[#00d4ff] text-black text-sm font-bold disabled:opacity-40"
          >
            {processing ? "Saving…" : "Use Photo"}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
