
import React, { useState, useRef, useEffect  } from 'react';
import { BoardType, PostAttachment, Post } from '../types';
interface PostEditorProps {
  type: BoardType;
  initialPost?: Post | null;
  onSave: (title: string, content: string, attachments?: any[], id?: string) => void;
  onCancel: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({ type, initialPost, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title);
      setContent(initialPost.content);
      setAttachments(initialPost.attachments || []);
    }
  }, [initialPost]);

  // ✅ 첨부 제한 (요청사항)
  // - 사진 5개 + 문서 3개 (총 8개)
  // - 파일당 최대 5MB (선택 시점 체크)
  // - 전체 합산 최대 15MB
  const MAX_TOTAL_FILES = 8;
  const MAX_IMAGE_FILES = 5;
  const MAX_DOC_FILES = 3;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  const MAX_TOTAL_SIZE = 15 * 1024 * 1024; // 15MB

  // bytes -> human readable (e.g. 5MB)
  const formatFileSize = (bytes: number) => {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0B';
    const units = ['B', 'KB', 'MB', 'GB'];
    let size = bytes;
    let idx = 0;
    while (size >= 1024 && idx < units.length - 1) {
      size /= 1024;
      idx += 1;
    }
    const fixed = idx === 0 ? 0 : 1;
    return `${size.toFixed(fixed)}${units[idx]}`;
  };

  // ✅ Storage 업로드 전 단계(작성 화면)에서는
  // - 파일은 File 객체로 보관
  // - 미리보기는 blob:ObjectURL 사용
  type DraftAttachment = PostAttachment & { file?: File; isNew?: boolean };

  const getExistingTotalBytes = () => {
    return attachments.reduce((sum, a: any) => sum + (a.size || 0), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const selected = Array.from(files);
    const currentImages = attachments.filter((a: any) => a.type?.startsWith('image/')).length;
    const currentDocs = attachments.length - currentImages;
    const selectedImages = selected.filter(f => f.type?.startsWith('image/')).length;
    const selectedDocs = selected.length - selectedImages;

    if (attachments.length + selected.length > MAX_TOTAL_FILES) {
      alert(`파일은 최대 ${MAX_TOTAL_FILES}개(사진 ${MAX_IMAGE_FILES} + 문서 ${MAX_DOC_FILES})까지만 업로드 가능합니다.`);
      return;
    }
    if (currentImages + selectedImages > MAX_IMAGE_FILES) {
      alert(`사진은 최대 ${MAX_IMAGE_FILES}개까지만 업로드 가능합니다.`);
      return;
    }
    if (currentDocs + selectedDocs > MAX_DOC_FILES) {
      alert(`문서는 최대 ${MAX_DOC_FILES}개까지만 업로드 가능합니다.`);
      return;
    }

    const tooLarge = selected.find(f => f.size > MAX_FILE_SIZE);
    if (tooLarge) {
      alert(`${tooLarge.name}: 파일 용량은 5MB 이하만 가능합니다.`);
      return;
    }

    const selectedTotal = selected.reduce((sum, f) => sum + f.size, 0);
    const existingTotal = getExistingTotalBytes();
    if (existingTotal + selectedTotal > MAX_TOTAL_SIZE) {
      alert(`첨부파일 총합은 최대 15MB까지만 가능합니다. (현재 약 ${formatFileSize(existingTotal)} + 선택 ${formatFileSize(selectedTotal)})`);
      return;
    }

    // ✅ DraftAttachment로 보관 (file 포함)
    for (const file of selected) {
      const previewUrl = URL.createObjectURL(file);
      setAttachments((prev: any[]) => {
        const imageIndex = file.type?.startsWith('image/')
          ? prev.filter((p: any) => p.type?.startsWith('image/')).length
          : -1;

        const next = [
          ...prev,
          {
            name: file.name,
            type: file.type,
            url: previewUrl,
            size: file.size,
            file,
            isNew: true,
          } as DraftAttachment,
        ];

        if (imageIndex >= 0 && contentRef.current) {
          insertImageTokenAtCursor(`[[img:${imageIndex}]]`);
        }
        return next;
      });
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev: any[]) => {
      const target = prev[index];
      try {
        if (target?.isNew && typeof target?.url === 'string' && target.url.startsWith('blob:')) {
          URL.revokeObjectURL(target.url);
        }
      } catch {}
      return prev.filter((_: any, i: number) => i !== index);
    });
  };


  const insertImageTokenAtCursor = (token: string) => {
    const ta = contentRef.current;
    setContent(prev => {
      // textarea가 아직 없으면 맨 아래에 추가
      if (!ta) return prev ? `${prev}\n${token}\n` : `${token}\n`;

      const start = ta.selectionStart ?? prev.length;
      const end = ta.selectionEnd ?? prev.length;

      const prefix = prev.slice(0, start);
      const suffix = prev.slice(end);

      const before = prefix && !prefix.endsWith('\n') ? prefix + '\n' : prefix;
      const after = suffix && !suffix.startsWith('\n') ? '\n' + suffix : suffix;
      const next = `${before}${token}${after}`;

      requestAnimationFrame(() => {
        try {
          const pos = before.length + token.length + (after.startsWith('\n') ? 1 : 0);
          ta.focus();
          ta.setSelectionRange(pos, pos);
        } catch {}
      });

      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto py-8 px-4"> 

      <div className="space-y-6 bg-white p-8 rounded-lg border">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">제목</label>
          <input
            type="text"
            className="w-full border-gray-300 rounded-lg p-3 text-lg font-bold border focus:ring-sky-500 outline-none"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>

        <div className="bg-gray-50 p-4 rounded-xl border-2 border-dashed border-gray-200">
          <label className="block text-sm font-bold text-gray-700 mb-2">
            <i className="fas fa-paperclip mr-2"></i> 첨부파일 (사진 최대 5개 / 문서 최대 3개 / 총 8개)
          </label>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.hwp"
          />
          <div className="space-y-2 mb-3">
            {attachments.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between bg-white p-3 rounded-lg border shadow-sm">
                <div className="flex items-center">
                  {file.type?.startsWith('image/') ? (
                    <img src={(file as any).url || (file as any).data} alt="preview" className="w-10 h-10 object-cover rounded mr-3" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3">
                      <i className={`fas ${file.type?.startsWith('video/') ? 'fa-video' : 'fa-file'} text-gray-400`}></i>
                    </div>
                  )}
                  <div className="text-xs">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-gray-400">{(((file as any).size || 0) / 1024).toFixed(1)} KB {file.type?.startsWith('image/') && <span className="text-emerald-500 font-bold ml-1">(최적화됨)</span>}</p>
                  </div>
                </div>
                <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-600 p-2 transition-colors">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
          {attachments.length < MAX_TOTAL_FILES ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-6 text-gray-400 text-sm hover:text-sky-primary hover:bg-white transition-all rounded-lg border border-dashed border-gray-300 flex flex-col items-center justify-center"
            >
              <i className="fas fa-plus-circle text-2xl mb-2"></i>
              <span>
                클릭하여 파일을 추가하세요 (현재 {attachments.length}/{MAX_TOTAL_FILES} · 사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES} · 문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES})
              </span>
              <span className="text-[10px] mt-1 text-sky-600 font-bold">
                파일당 최대 {formatFileSize(MAX_FILE_SIZE)} · 총합 최대 {formatFileSize(MAX_TOTAL_SIZE)}
              </span>
            </button>
          ) : (
            <p className="text-center text-xs text-orange-500 font-medium py-2">최대 파일 개수에 도달했습니다.</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
          <textarea
            ref={contentRef}
            className="w-full border-gray-300 rounded-lg p-3 h-64 border focus:ring-sky-500 outline-none resize-none leading-relaxed"
            value={content}
            onChange={(e) => setContent(e.target.value)}
          ></textarea>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={onCancel} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={() => onSave(title, content, attachments, initialPost?.id)}
            disabled={!title || !content}
            className="px-6 py-2 bg-sky-primary text-white rounded-lg font-bold hover:opacity-90 disabled:opacity-50 transition-all"
          >
            {initialPost ? '수정 완료' : '게시하기'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PostEditor;
