import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Camera, 
  Upload, 
  Sparkles, 
  RotateCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Info,
  Maximize2,
  RefreshCw,
  Ban,
  ShieldAlert,
  ClipboardPaste,
  ArrowDownCircle,
  AlertTriangle,
  Calendar
} from 'lucide-react';
import { ReceiptAnalysisResult, WalletType } from '../types';
import { WALLETS, WALLET_RULES, validateReceiptDateAgainstShift } from '../data/constants';

interface ImageScannerProps {
  photoDataUrl: string | null;
  onPhotoSelected: (dataUrl: string | null) => void;
  onAnalysisComplete: (result: ReceiptAnalysisResult) => void;
  selectedWallet: WalletType | null;
  onSelectWallet: (wallet: WalletType) => void;
  workDate?: string;
  onUpdateWorkDate?: (newDate: string) => void;
}

export const ImageScanner: React.FC<ImageScannerProps> = ({
  photoDataUrl,
  onPhotoSelected,
  onAnalysisComplete,
  selectedWallet,
  onSelectWallet,
  workDate,
  onUpdateWorkDate,
}) => {
  const [isScanning, setIsScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ReceiptAnalysisResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isCameraLoading, setIsCameraLoading] = useState(false);
  const [cameraFacing, setCameraFacing] = useState<'environment' | 'user'>('environment');
  const [rotationAngle, setRotationAngle] = useState(0);
  const [isDraggingOverScreen, setIsDraggingOverScreen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const dragCounterRef = useRef<number>(0);

  // Stop camera when unmounting or photo selected
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setIsCameraLoading(false);
  };

  const startCamera = async (targetFacing?: 'environment' | 'user') => {
    const facing = targetFacing || cameraFacing;
    setErrorMsg(null);
    setIsCameraLoading(true);
    setIsCameraActive(true);

    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Safe checks for mediaDevices support in browser/iframe context
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('متصفحك الحالي أو بيئة العرض لا تدعم الوصول المباشر للكاميرا. يمكنك استخدام زر اختيار صورة أو اللصق.');
      }

      let stream: MediaStream | null = null;
      
      // Step 1: Try with ideal facingMode
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('Initial camera constraint failed:', firstErr);
        
        // Step 2: Try simple facingMode
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: facing },
            audio: false,
          });
        } catch (secondErr) {
          console.warn('Facing constraint failed, trying opposite facing mode:', secondErr);
          
          // Step 3: Try opposite facing mode (e.g. laptop webcam is 'user' not 'environment')
          const altFacing = facing === 'environment' ? 'user' : 'environment';
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: { facingMode: altFacing },
              audio: false,
            });
            setCameraFacing(altFacing);
          } catch (thirdErr) {
            console.warn('Alternative facing failed, trying generic video constraint:', thirdErr);
            
            // Step 4: Fallback to any available video device
            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: false,
              });
            } catch (deviceErr: any) {
              console.warn('All video constraints failed:', deviceErr);
              throw deviceErr;
            }
          }
        }
      }

      if (!stream) {
        throw new Error('لم يتم العثور على كاميرا متصلة بالجهاز');
      }

      streamRef.current = stream;

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.muted = true;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('Video auto-play delayed:', playErr);
        }
      }
      setIsCameraLoading(false);
    } catch (err: any) {
      console.error('Camera access error:', err?.name || err?.message || err);
      setIsCameraActive(false);
      setIsCameraLoading(false);

      if (err?.name === 'NotFoundError' || err?.message?.includes('Requested device not found') || err?.message?.includes('DevicesNotFoundError')) {
        setErrorMsg('لم يتم العثور على كاميرا متصلة بهذا الجهاز أو اللابتوب. يمكنك اختيار صورة الإشعار من الملفات أو نسخها ولصقها.');
      } else if (err?.name === 'NotAllowedError' || err?.name === 'PermissionDeniedError') {
        setErrorMsg('تم رفض إذن الوصول للكاميرا. يرجى السماح بالوصول من إعدادات المتصفح أو اختيار صورة من الملفات.');
      } else {
        setErrorMsg(err?.message || 'تعذر فتح الكاميرا، يرجى اختيار صورة الإشعار من الملفات أو لصقها.');
      }
    }
  };

  // Re-attach stream when videoRef mounts if stream already exists
  useEffect(() => {
    if (isCameraActive && streamRef.current && videoRef.current) {
      if (videoRef.current.srcObject !== streamRef.current) {
        videoRef.current.srcObject = streamRef.current;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        videoRef.current.play().catch(console.warn);
      }
    }
  }, [isCameraActive]);

  const toggleCameraFacing = () => {
    const nextFacing = cameraFacing === 'environment' ? 'user' : 'environment';
    setCameraFacing(nextFacing);
    startCamera(nextFacing);
  };

  // Helper to resize and optimize image before sending to API to prevent heavy payload timeouts and speed up AI inference (<3s)
  const optimizeImageForScan = (dataUrl: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 960;
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.80));
        } else {
          resolve(dataUrl);
        }
      };
      img.onerror = () => resolve(dataUrl);
      img.src = dataUrl;
    });
  };

  const processOptimizedImage = useCallback(async (rawUrl: string) => {
    stopCamera();
    setRotationAngle(0);
    // Optimize deterministically once so stored image and analyzed image share the exact same hash
    const optimized = await optimizeImageForScan(rawUrl);
    onPhotoSelected(optimized);
    analyzeImage(optimized);
  }, [onPhotoSelected]);

  const capturePhoto = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const width = video.videoWidth || 1280;
    const height = video.videoHeight || 720;
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      await processOptimizedImage(dataUrl);
    }
  };

  const processFile = useCallback((file: Blob | File) => {
    setErrorMsg(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl && dataUrl.startsWith('data:image/')) {
        await processOptimizedImage(dataUrl);
      } else {
        setErrorMsg('صيغة الملف غير مدعومة كصورة إيصال.');
      }
    };
    reader.readAsDataURL(file);
  }, [processOptimizedImage]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
    e.target.value = '';
  };

  // Helper to extract image data from DataTransfer or Clipboard
  const extractImageFromDataTransfer = useCallback(async (dataTransfer: DataTransfer): Promise<boolean> => {
    // 1. Direct files from drag & drop or file system
    if (dataTransfer.files && dataTransfer.files.length > 0) {
      for (let i = 0; i < dataTransfer.files.length; i++) {
        const file = dataTransfer.files[i];
        if (file.type.startsWith('image/')) {
          processFile(file);
          return true;
        }
      }
    }

    // 2. DataTransfer items (e.g. dragging images directly from web pages/WhatsApp)
    if (dataTransfer.items && dataTransfer.items.length > 0) {
      for (let i = 0; i < dataTransfer.items.length; i++) {
        const item = dataTransfer.items[i];
        if (item.type.startsWith('image/')) {
          const blob = item.getAsFile();
          if (blob) {
            processFile(blob);
            return true;
          }
        }
      }
    }

    // 3. HTML content (often dragged from WhatsApp Web or other tabs)
    const htmlData = dataTransfer.getData('text/html');
    if (htmlData) {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlData, 'text/html');
      const img = doc.querySelector('img');
      if (img && img.src) {
        if (img.src.startsWith('data:image/')) {
          stopCamera();
          setRotationAngle(0);
          onPhotoSelected(img.src);
          analyzeImage(img.src);
          return true;
        }
        try {
          const res = await fetch(img.src);
          const blob = await res.blob();
          if (blob.type.startsWith('image/')) {
            processFile(blob);
            return true;
          }
        } catch (e) {
          console.warn('Could not fetch image src from dragged HTML:', e);
        }
      }
    }

    // 4. URI / URL list or plain text (data URI or remote link)
    const uriData = dataTransfer.getData('text/uri-list') || dataTransfer.getData('text/plain');
    if (uriData) {
      const trimmed = uriData.trim();
      if (trimmed.startsWith('data:image/')) {
        stopCamera();
        setRotationAngle(0);
        onPhotoSelected(trimmed);
        analyzeImage(trimmed);
        return true;
      }
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
        try {
          const res = await fetch(trimmed);
          const blob = await res.blob();
          if (blob.type.startsWith('image/')) {
            processFile(blob);
            return true;
          }
        } catch (e) {
          console.warn('Could not fetch image from URI:', e);
        }
      }
    }

    return false;
  }, [processFile, onPhotoSelected]);

  // Global Paste Handler (Ctrl+V anywhere on the page)
  useEffect(() => {
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      if (!e.clipboardData) return;
      const activeTag = document.activeElement?.tagName?.toLowerCase();
      if (activeTag === 'input' || activeTag === 'textarea') {
        return;
      }
      const handled = await extractImageFromDataTransfer(e.clipboardData);
      if (handled) {
        e.preventDefault();
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [extractImageFromDataTransfer]);

  // Global Drag and Drop handlers across entire window
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current += 1;
      if (e.dataTransfer && e.dataTransfer.types.length > 0) {
        setIsDraggingOverScreen(true);
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current -= 1;
      if (dragCounterRef.current <= 0) {
        dragCounterRef.current = 0;
        setIsDraggingOverScreen(false);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounterRef.current = 0;
      setIsDraggingOverScreen(false);

      if (e.dataTransfer) {
        const handled = await extractImageFromDataTransfer(e.dataTransfer);
        if (!handled) {
          setErrorMsg('لم نتمكن من قراءة الصورة المسحوبة مباشرة. يمكنك أيضاً نسخ الصورة من واتساب ولصقها هنا (Ctrl+V أو زر لصق الصورة).');
        }
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [extractImageFromDataTransfer]);

  // Manual Paste button using Clipboard API
  const handlePasteFromClipboard = async () => {
    setErrorMsg(null);
    try {
      if (navigator.clipboard && navigator.clipboard.read) {
        const items = await navigator.clipboard.read();
        for (const item of items) {
          for (const type of item.types) {
            if (type.startsWith('image/')) {
              const blob = await item.getType(type);
              processFile(blob);
              return;
            }
          }
        }
      }
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.startsWith('data:image/')) {
          await processOptimizedImage(text);
          return;
        }
      }
      setErrorMsg('لم يتم العثور على صورة في الحافظة. اضغط بالزر الأيمن على صورة الإشعار في واتساب واختر "نسخ الصورة" ثم اضغط هنا.');
    } catch (err: any) {
      console.warn('Clipboard read error:', err);
      setErrorMsg('يرجى الضغط على زر Ctrl + V من لوحة المفاتيح للصق الصورة مباشرة.');
    }
  };

  const rotateImage = () => {
    if (!photoDataUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Swap width and height for 90 or 270 degree rotations
      canvas.width = img.height;
      canvas.height = img.width;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.width / 2, -img.height / 2);

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 0.88);
      onPhotoSelected(rotatedDataUrl);
      setRotationAngle((prev) => (prev + 90) % 360);
    };
    img.src = photoDataUrl;
  };

  const analyzeImage = async (dataUrl: string) => {
    setIsScanning(true);
    setErrorMsg(null);
    setScanResult(null);

    try {
      // Optimize image resolution to ensure fast upload
      const payloadImage = await optimizeImageForScan(dataUrl);

      // Bounded fetch with 25-second safeguard for AI vision recognition
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        try {
          controller.abort();
        } catch {
          // ignore
        }
      }, 25000);

      let res: Response | null = null;
      try {
        res = await fetch('/api/analyze-receipt', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            imageBase64: payloadImage,
            mimeType: 'image/jpeg',
            work_date: workDate,
          }),
          signal: controller.signal,
        });
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') {
          console.warn('Receipt scan timed out after 25s.');
        } else {
          console.warn('Receipt fetch warning:', fetchErr?.message || fetchErr);
        }
      } finally {
        clearTimeout(timeoutId);
      }

      if (!res || !res.ok) {
        const fallbackResult = {
          success: false,
          detected_wallet: null,
          confidence: 0,
          notes: 'تم حفظ صورة الإيصال. يرجى تحديد المحفظة والمبلغ يدوياً.',
        };
        setScanResult(fallbackResult);
        onAnalysisComplete(fallbackResult);
        setErrorMsg('تم حفظ الصورة بنجاح. يمكنك اختيار نوع المحفظة وإدخال المبلغ يدوياً.');
        return;
      }

      const text = await res.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch (parseErr) {
        console.warn('Non-JSON response received:', text.slice(0, 100));
        const fallbackResult = {
          success: false,
          detected_wallet: null,
          confidence: 0,
          notes: 'تم حفظ صورة الإيصال.',
        };
        setScanResult(fallbackResult);
        onAnalysisComplete(fallbackResult);
        return;
      }

      setScanResult(data);
      onAnalysisComplete(data);

      if (data.detected_wallet && WALLETS.includes(data.detected_wallet as WalletType)) {
        onSelectWallet(data.detected_wallet as WalletType);
      }
    } catch (err: any) {
      console.warn('Scan process warning:', err?.message || err);
      setErrorMsg('تم حفظ الصورة بنجاح. يمكنك اختيار نوع المحفظة وإدخال المبلغ يدوياً.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="space-y-4 relative w-full max-w-full overflow-x-hidden">
      {/* Full-Screen Drag and Drop Overlay */}
      {isDraggingOverScreen && (
        <div className="fixed inset-0 z-50 bg-emerald-950/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-4 sm:p-6 border-4 border-dashed border-emerald-400 m-2 rounded-3xl animate-in fade-in zoom-in duration-150">
          <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center mb-4 sm:mb-6 ring-8 ring-emerald-500/30 animate-bounce">
            <ArrowDownCircle className="w-10 h-10 sm:w-14 sm:h-14" />
          </div>
          <h2 className="text-xl sm:text-3xl font-bold text-white mb-2 text-center">
            أفلت صورة إشعار واتساب هنا الآن!
          </h2>
          <p className="text-xs sm:text-base text-emerald-200 text-center max-w-md">
            سيقوم النظام باستخراج بيانات الإيصال وتحديد المحفظة ورقم الحوالة والمبلغ تلقائياً
          </p>
        </div>
      )}

      {/* Upload / Camera Action Buttons */}
      {!photoDataUrl && !isCameraActive && (
        <div 
          onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (e.dataTransfer) {
              extractImageFromDataTransfer(e.dataTransfer);
            }
          }}
          className="border-2 border-dashed border-stone-300 hover:border-red-700 bg-stone-50/80 hover:bg-stone-100/90 rounded-2xl p-4 sm:p-7 text-center transition-all"
        >
          {/* File Picker */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />

          <div className="flex flex-col sm:flex-row items-center justify-center gap-2.5 sm:gap-3 w-full">
            {/* Upload from Gallery / Files */}
            <button
              id="upload-file-btn"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 sm:py-2.5 rounded-xl shadow-md border border-stone-700 transition"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>اختيار صورة</span>
            </button>

            {/* Live Web Scanner */}
            <button
              id="open-camera-btn"
              type="button"
              onClick={() => startCamera()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-red-800 to-rose-900 hover:from-red-700 hover:to-rose-800 active:scale-95 text-white font-black text-xs sm:text-sm px-5 py-3 sm:py-2.5 rounded-xl shadow-md shadow-red-950/30 border border-amber-400/20 transition"
            >
              <Maximize2 className="w-4 h-4 text-amber-300" />
              <span>فتح الكاميرا</span>
            </button>
          </div>
        </div>
      )}

      {/* Live Camera View */}
      {isCameraActive && (
        <div className="bg-slate-900 rounded-2xl p-4 text-white overflow-hidden relative shadow-lg">
          <div className="relative aspect-[3/4] max-h-[480px] mx-auto bg-black rounded-xl overflow-hidden flex items-center justify-center">
            {isCameraLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-slate-950/80 text-white gap-2">
                <Loader2 className="w-8 h-8 text-red-500 animate-spin" />
                <span className="text-xs text-slate-300">جاري تشغيل الكاميرا...</span>
              </div>
            )}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={(e) => {
                const target = e.currentTarget;
                target.play().catch(console.warn);
                setIsCameraLoading(false);
              }}
              className="w-full h-full object-cover"
            />
            {/* Camera Guide Frame */}
            <div className="absolute inset-8 border-2 border-dashed border-red-500/80 rounded-xl pointer-events-none flex flex-col justify-between p-3">
              <span className="text-[11px] bg-red-700/90 px-2 py-0.5 rounded text-white self-start font-bold">
                ضع الإيصال داخل الإطار
              </span>
              <div className="w-full border-t border-red-500/40"></div>
            </div>
          </div>

          <div className="flex items-center justify-between mt-4 px-2">
            <button
              type="button"
              onClick={toggleCameraFacing}
              className="flex items-center gap-1.5 text-xs text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 active:scale-95 px-3.5 py-2.5 rounded-xl border border-slate-700 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>تبديل العدسة ({cameraFacing === 'environment' ? 'الخلفية' : 'الأمامية'})</span>
            </button>

            <button
              id="camera-capture-trigger"
              type="button"
              onClick={capturePhoto}
              className="w-16 h-16 rounded-full bg-white border-4 border-red-600 shadow-lg flex items-center justify-center text-slate-900 active:scale-90 transition hover:bg-slate-100"
              title="التقاط الصورة"
            >
              <div className="w-12 h-12 rounded-full bg-red-700 hover:bg-red-800 transition"></div>
            </button>

            <button
              type="button"
              onClick={stopCamera}
              className="text-xs text-rose-300 hover:text-rose-100 bg-rose-950/60 hover:bg-rose-900/80 active:scale-95 px-4 py-2.5 rounded-xl border border-rose-800/50 transition"
            >
              إلغاء
            </button>
          </div>
        </div>
      )}

      {/* Selected Photo Preview & AI Recognition Panel */}
      {photoDataUrl && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
            
            {/* Image Preview Column */}
            <div className="md:col-span-5 relative group bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center min-h-[260px] max-h-[360px]">
              <img
                src={photoDataUrl}
                alt="إيصال الدفع"
                className="max-h-[350px] w-auto object-contain transition-transform"
              />

              {/* Action Overlay */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-xs p-1 rounded-lg">
                <button
                  type="button"
                  onClick={rotateImage}
                  className="p-1.5 text-white hover:bg-white/20 rounded-md transition"
                  title="تدوير الصورة 90 درجة"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onPhotoSelected(null);
                    setScanResult(null);
                  }}
                  className="p-1.5 text-rose-400 hover:bg-rose-900/50 rounded-md transition"
                  title="حذف واختيار صورة أخرى"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Duplicate Badge Overlay on Image */}
              {scanResult?.is_duplicate && (
                <div className="absolute bottom-2 inset-x-2 bg-rose-600/90 backdrop-blur-xs text-white text-[11px] font-extrabold py-1 px-2.5 rounded-lg flex items-center justify-center gap-1.5 text-center shadow-lg">
                  <Ban className="w-3.5 h-3.5 shrink-0" />
                  <span>إيصال مكرر ومسجل مسبقاً (مرفوض)</span>
                </div>
              )}

              {isScanning && (
                <div className="absolute inset-0 bg-slate-900/75 backdrop-blur-xs flex flex-col items-center justify-center text-white p-4 text-center">
                  <div className="relative">
                    <Loader2 className="w-10 h-10 text-red-500 animate-spin mb-2" />
                    <Sparkles className="w-4 h-4 text-amber-400 absolute top-0 right-0 animate-ping" />
                  </div>
                  <p className="font-bold text-sm">جاري الفحص بالذكاء الاصطناعي...</p>
                  <p className="text-xs text-slate-300 mt-1">
                    قراءة المحفظة، المبلغ، والبيانات بدقة فائقة
                  </p>
                </div>
              )}
            </div>

            {/* AI Extraction & Details Column */}
            <div className="md:col-span-7 flex flex-col justify-between space-y-3">
              
              <div>
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                    <Sparkles className="w-4 h-4 text-red-700" />
                    <span>نتائج الفحص الذكي للإيصال</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => analyzeImage(photoDataUrl)}
                    disabled={isScanning}
                    className="text-xs text-red-700 hover:text-red-900 font-bold flex items-center gap-1"
                  >
                    <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                    <span>إعادة الفحص</span>
                  </button>
                </div>

                {/* PROMINENT DUPLICATE RECEIPT WARNING BANNER */}
                {scanResult?.is_duplicate && (
                  <div className="my-3 p-3.5 bg-rose-50 border-2 border-rose-400 rounded-xl space-y-2.5 shadow-sm">
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                        <Ban className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-sm font-black text-rose-900">
                          ⚠️ تنبيه أمني: هذا الإيصال مكرر ومسجل مسبقاً!
                        </h4>
                        <p className="text-xs text-rose-700 mt-0.5 leading-relaxed font-medium">
                          تم الكشف عن أن صورة هذا الإيصال أو كود المعاملة مسجل بالفعل في النظام.
                          <strong className="block text-rose-900 mt-0.5">لا يمكن قبول هذا الإيصال لتفادي تكرار التحويل أو العمليات المزدوجة.</strong>
                        </p>
                      </div>
                    </div>

                    {scanResult.duplicate_match && (
                      <div className="bg-white/90 p-2.5 rounded-lg border border-rose-200 text-xs space-y-1.5">
                        <div className="font-bold text-rose-950 flex items-center gap-1">
                          <ShieldAlert className="w-3.5 h-3.5 text-rose-600" />
                          <span>بيانات الطلب المسجل مسبقاً بنفس الإيصال:</span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px] text-slate-700 bg-rose-50/50 p-2 rounded-md">
                          <div>
                            <span className="text-slate-500 block">رقم الطلب:</span>
                            <strong className="text-slate-900 text-xs font-mono">#{scanResult.duplicate_match.order_num}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">الفرع:</span>
                            <strong className="text-slate-900">{scanResult.duplicate_match.branch}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">المحفظة:</span>
                            <strong className="text-slate-900">{scanResult.duplicate_match.wallet}</strong>
                          </div>
                          <div>
                            <span className="text-slate-500 block">الوردية:</span>
                            <strong className="text-slate-900">{scanResult.duplicate_match.work_date}</strong>
                          </div>
                          {scanResult.duplicate_match.amount && (
                            <div>
                              <span className="text-slate-500 block">المبلغ:</span>
                              <strong className="text-emerald-700 font-bold">{scanResult.duplicate_match.amount} ج.م</strong>
                            </div>
                          )}
                          {scanResult.duplicate_match.reference_num && (
                            <div>
                              <span className="text-slate-500 block">الرقم المرجعي:</span>
                              <strong className="font-mono text-slate-900">{scanResult.duplicate_match.reference_num}</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] font-extrabold text-rose-700 bg-rose-100 px-2 py-0.5 rounded">
                        الحالة: غير مقبول (مرفوض)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          onPhotoSelected(null);
                          setScanResult(null);
                        }}
                        className="text-xs bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-bold px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>حذف ورفع إيصال جديد</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Scan Status Display */}
                {scanResult ? (
                  <div className="mt-3 space-y-2.5">
                    {/* Security Alert: Strict Rejection for Past Date */}
                    {scanResult.receipt_date && workDate && (() => {
                      const dateVal = validateReceiptDateAgainstShift(scanResult.receipt_date, workDate);
                      
                      // Case 1: Past date -> Strict Rejection
                      if (dateVal.status === 'past_date_rejected') {
                        return (
                          <div className="p-3.5 bg-rose-50 border-2 border-rose-500 rounded-xl space-y-2.5 shadow-sm animate-in fade-in">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <ShieldAlert className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-rose-200 text-rose-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    مرفوض أمنياً
                                  </span>
                                  <h4 className="text-sm font-black text-rose-950">
                                    إيصال سابق للوردية (لا يمكن قبوله)!
                                  </h4>
                                </div>
                                <p className="text-xs text-rose-900 mt-1 leading-relaxed font-medium">
                                  تاريخ الإشعار هو{' '}
                                  <strong className="font-mono font-black text-rose-950 bg-rose-200/80 px-1.5 py-0.5 rounded">
                                    {scanResult.receipt_date} {scanResult.receipt_time ? `(${scanResult.receipt_time})` : ''}
                                  </strong>{' '}
                                  وهو أقدم من تاريخ الوردية الحالية ({workDate}). تم حظر تسجيل الإيصال لمنع تكرار أو تمرير إيصالات قديمة.
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      // Case 2: Future Date Mismatch (beyond next day)
                      if (dateVal.status === 'future_date_mismatch') {
                        return (
                          <div className="p-3.5 bg-amber-50/95 border-2 border-amber-400 rounded-xl space-y-2.5 shadow-sm animate-in fade-in">
                            <div className="flex items-start gap-2.5">
                              <div className="w-8 h-8 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                <AlertTriangle className="w-5 h-5" />
                              </div>
                              <div className="flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="bg-amber-200 text-amber-900 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                                    تنبيه أمان
                                  </span>
                                  <h4 className="text-sm font-black text-amber-950">
                                    تاريخ الإيصال يختلف عن تاريخ الوردية!
                                  </h4>
                                </div>
                                <p className="text-xs text-amber-900 mt-1 leading-relaxed font-medium">
                                  تاريخ التحويل المسجل بالإيصال هو{' '}
                                  <strong className="font-mono font-black text-amber-950 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                    {scanResult.receipt_date} {scanResult.receipt_time ? `(${scanResult.receipt_time})` : ''}
                                  </strong>{' '}
                                  بينما تاريخ الوردية هو{' '}
                                  <strong className="font-mono font-black text-amber-950 bg-amber-200/80 px-1.5 py-0.5 rounded">
                                    {workDate}
                                  </strong>.
                                </p>
                              </div>
                            </div>

                            {onUpdateWorkDate && (
                              <div className="bg-white/90 p-2.5 rounded-lg border border-amber-200 flex items-center justify-between gap-2 flex-wrap text-xs">
                                <span className="text-amber-900 font-bold text-[11px]">
                                  هل ترغب بمزامنة الوردية لتطابق تاريخ الإيصال؟
                                </span>
                                <button
                                  type="button"
                                  onClick={() => onUpdateWorkDate(scanResult.receipt_date!)}
                                  className="bg-amber-600 hover:bg-amber-700 active:scale-95 text-white font-black px-3 py-1.5 rounded-lg transition shadow-xs flex items-center gap-1.5 text-xs cursor-pointer"
                                >
                                  <Calendar className="w-3.5 h-3.5" />
                                  <span>تعديل تاريخ الوردية إلى {scanResult.receipt_date}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      }

                      // Case 3: Post Midnight within shift -> Accepted smoothly with 0 error alerts
                      if (dateVal.status === 'post_midnight') {
                        return (
                          <div className="p-2.5 bg-emerald-50/90 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            <span className="font-bold">
                              ✓ إشعار بعد الساعة 12 منتصف الليل ({scanResult.receipt_date}) مقبول تلقائياً لنفس الوردية.
                            </span>
                          </div>
                        );
                      }

                      // Case 4: Exact match
                      return (
                        <div className="p-2.5 bg-emerald-50/90 border border-emerald-300 rounded-xl text-xs text-emerald-950 flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span className="font-bold">
                            ✓ تم التحقق الأمني: تاريخ التحويل بالإيصال ({scanResult.receipt_date}) مطابق لتاريخ الوردية.
                          </span>
                        </div>
                      );
                    })()}

                    {/* Detected Wallet Badge */}
                    <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-emerald-800 font-extrabold">
                          المحفظة المكتشفة تلقائياً:
                        </span>
                        {scanResult.confidence && (
                          <span className="text-[11px] bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded-full font-bold">
                            دقة {Math.round(scanResult.confidence * 100)}%
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        <span className="text-base font-extrabold text-emerald-950">
                          {scanResult.detected_wallet || 'غير محددة تلقائياً'}
                        </span>
                      </div>
                      {scanResult.notes && (
                        <p className="text-xs text-slate-600 mt-1.5 bg-white/60 p-2 rounded-lg border border-emerald-100">
                          {scanResult.notes}
                        </p>
                      )}
                    </div>

                    {/* Extracted Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      {scanResult.amount ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500 block">المبلغ المقروء:</span>
                          <span className="text-sm font-bold text-emerald-600">
                            {scanResult.amount} {scanResult.currency || 'ج.م'}
                          </span>
                        </div>
                      ) : null}

                      {scanResult.reference_num ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500 block">رقم المعاملة / المرجع:</span>
                          <span className="text-xs font-mono font-bold text-slate-800 truncate block dir-ltr text-right">
                            {scanResult.reference_num}
                          </span>
                        </div>
                      ) : null}

                      {scanResult.recipient_name ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500 block">المستلم:</span>
                          <span className="font-semibold text-slate-800">{scanResult.recipient_name}</span>
                        </div>
                      ) : null}

                      {scanResult.receipt_date ? (
                        <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                          <span className="text-slate-500 block">تاريخ الإيصال:</span>
                          <span className="font-semibold text-slate-800">
                            {scanResult.receipt_date} {scanResult.receipt_time || ''}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-slate-100 rounded-xl text-center my-3">
                    <p className="text-xs text-slate-500">
                      سيتم عرض البيانات المستخرجة من الإيصال هنا فور اكتمال الفحص.
                    </p>
                  </div>
                )}
              </div>

              {/* Wallet Confirmation or Override Selection */}
              <div className="pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700">
                    تأكيد نوع المحفظة لهذا الطلب:
                  </label>
                  {!selectedWallet ? (
                    <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                      يرجى اختيار المحفظة
                    </span>
                  ) : (
                    <span className="text-[11px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                      تم الاختيار ✓
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {WALLETS.map((w) => {
                    const isSelected = selectedWallet === w;
                    return (
                      <button
                        key={w}
                        type="button"
                        onClick={() => onSelectWallet(w)}
                        className={`p-2 rounded-xl text-xs font-bold text-center transition-all border leading-snug flex items-center justify-center min-h-[44px] ${
                          isSelected
                            ? 'bg-red-700 text-white border-red-700 shadow-xs ring-2 ring-red-700/30'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50 hover:border-slate-300'
                        }`}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {errorMsg && (
        <div className="flex items-center gap-2 text-xs text-rose-700 bg-rose-50 border border-rose-200 p-3 rounded-xl">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
    </div>
  );
};
