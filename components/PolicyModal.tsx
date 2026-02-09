type PolicyModalProps = {
  isOpen: boolean;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
};

export default function PolicyModal({ isOpen, title, children, onClose }: PolicyModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <button
        aria-label="닫기"
        onClick={onClose}
        className="absolute inset-0 bg-black/50"
      />

      {/* Panel */}
      <div className="relative w-[92vw] max-w-2xl max-h-[85vh] overflow-hidden rounded-2xl bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="text-base font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-gray-600 hover:bg-gray-100"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 overflow-auto text-sm text-gray-700 leading-6 whitespace-pre-line flex-1">
          {children}
        </div>

        {/* Bottom Close Button */}
        <div className="border-t px-5 py-3 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-md bg-gray-800 text-white px-4 py-2 text-sm hover:bg-gray-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
