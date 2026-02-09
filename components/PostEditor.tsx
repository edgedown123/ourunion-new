
import React, { useState, useRef, useEffect  } from 'react';
import { BoardType, PostAttachment, Post } from '../types';
interface PostEditorProps {
  type: BoardType;
  initialPost?: Post | null;
  onSave: (title: string, content: string, attachments?: PostAttachment[], password?: string, id?: string) => void;
  onCancel: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({ type, initialPost, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const contentRef = useRef<HTMLTextAreaElement | null>(null);
  const [postPassword, setPostPassword] = useState('');
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title);
      setContent(initialPost.content);
      setPostPassword(initialPost.password || '');
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

  const compressImage = (base64Str: string, maxWidth = 1200): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    });
  };

  // dataURL( base64 ) 대략 용량 계산 (서버에 저장된 데이터 기준)
  const dataUrlToBytes = (dataUrl: string): number => {
    const commaIdx = dataUrl.indexOf(',');
    if (commaIdx === -1) return 0;
    const base64 = dataUrl.slice(commaIdx + 1);
    // base64 size -> bytes
    let padding = 0;
    if (base64.endsWith('==')) padding = 2;
    else if (base64.endsWith('=')) padding = 1;
    return Math.max(0, Math.floor((base64.length * 3) / 4) - padding);
  };

  const getExistingTotalBytes = () => {
    return attachments.reduce((sum, a) => sum + dataUrlToBytes(a.data), 0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const selected = Array.from(files);
    const currentImages = attachments.filter(a => a.type?.startsWith('image/')).length;
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
    const processFile = async (file: File) => {
      if (file.size > MAX_FILE_SIZE) {
        alert(`${file.name}: 파일 용량은 5MB 이하만 가능합니다.`);
        return;
      }
      const reader = new FileReader();
      reader.onloadend = async () => {
        let fileData = reader.result as string;
        if (file.type?.startsWith('image/')) {
          fileData = await compressImage(fileData);
        }
        setAttachments(prev => {
          const imageIndex = file.type?.startsWith('image/')
            ? prev.filter(p => p.type?.startsWith('image/')).length
            : -1;
          const next = [...prev, { name: file.name, data: fileData, type: file.type }];

          // 글쓰기 textarea가 마운트된 경우에만 커서 위치에 토큰 삽입
          if (imageIndex >= 0 && contentRef.current) {
            insertImageTokenAtCursor(`[[img:${imageIndex}]]`);
          }
          return next;
        });
      };
      reader.readAsDataURL(file);
    };
    
    for (const file of Array.from(files) as File[]) {
      await processFile(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center">
            수정/삭제용 비밀번호 <span className="text-[10px] text-sky-primary ml-2">* 모든 게시물에 필수로 입력해야 합니다.</span>
          </label>
          <input
            type="password"
            className="w-full sm:w-64 border-gray-300 rounded-lg p-3 border focus:ring-sky-500 outline-none"
            placeholder="4자리 이상 입력"
            value={postPassword}
            onChange={(e) => setPostPassword(e.target.value)}
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
                    <img src={file.data} alt="preview" className="w-10 h-10 object-cover rounded mr-3" />
                  ) : (
                    <div className="w-10 h-10 bg-gray-100 rounded flex items-center justify-center mr-3">
                      <i className={`fas ${file.type?.startsWith('video/') ? 'fa-video' : 'fa-file'} text-gray-400`}></i>
                    </div>
                  )}
                  <div className="text-xs">
                    <p className="font-medium text-gray-800 truncate max-w-[200px]">{file.name}</p>
                    <p className="text-gray-400">{(file.data.length * 0.75 / 1024).toFixed(1)} KB {file.type?.startsWith('image/') && <span className="text-emerald-500 font-bold ml-1">(최적화됨)</span>}</p>
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
            onClick={() => onSave(title, content, attachments, postPassword, initialPost?.id)}
            disabled={!title || !content || !postPassword}
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
