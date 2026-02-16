
import React, { useState, useRef, useEffect  } from 'react';
import { BoardType, PostAttachment, Post } from '../types';
interface PostEditorProps {
  type: BoardType;
  initialPost?: Post | null;
  onSave: (title: string, content: string, attachments?: PostAttachment[], id?: string) => void;
  onCancel: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({ type, initialPost, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  // ✅ WYSIWYG: 텍스트/이미지 블록 편집(사용자는 토큰을 보지 않음)
  type EditorBlock =
    | { kind: 'text'; id: string; value: string }
    | { kind: 'img'; id: string; imgIndex: number };
  const [blocks, setBlocks] = useState<EditorBlock[]>([{ kind: 'text', id: 't0', value: '' }]);
  const [dragBlockIndex, setDragBlockIndex] = useState<number | null>(null);
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  // ✅ 드래그로 이미지 순서 변경(모바일/데스크톱 공통)
  const [dragImgIndex, setDragImgIndex] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 768;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title);
      setContent(initialPost.content);
      setAttachments(initialPost.attachments || []);
      setBlocks(parseContentToBlocks(initialPost.content));
    }
  }, [initialPost]);

  useEffect(() => {
    setContent(blocksToContent(blocks));
  }, [blocks]);

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
  
  const newId = () => Math.random().toString(36).slice(2, 9);

  const parseContentToBlocks = (raw: string): EditorBlock[] => {
    const text = raw ?? '';
    const reToken = /\[\[img:(\d+)\]\]/g;
    const result: EditorBlock[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = reToken.exec(text)) !== null) {
      const start = m.index;
      const end = reToken.lastIndex;
      const before = text.slice(last, start);
      if (before.length > 0) result.push({ kind: 'text', id: newId(), value: before });
      const num = Number(m[1]);
      if (Number.isFinite(num)) result.push({ kind: 'img', id: newId(), imgIndex: num });
      last = end;
    }
    const tail = text.slice(last);
    if (tail.length > 0) result.push({ kind: 'text', id: newId(), value: tail });

    // 최소 1개 텍스트 블록은 유지
    if (result.length === 0) return [{ kind: 'text', id: 't0', value: '' }];
    // 연속 텍스트 블록 합치기
    const merged: EditorBlock[] = [];
    for (const b of result) {
      const prev = merged[merged.length - 1];
      if (b.kind === 'text' && prev?.kind === 'text') {
        prev.value += b.value;
      } else {
        merged.push(b);
      }
    }
    return merged;
  };

  const blocksToContent = (bs: EditorBlock[]): string => {
    return bs
      .map(b => (b.kind === 'text' ? b.value : `[[img:${b.imgIndex}]]`))
      .join('');
  };

  const insertTextBlockAfter = (afterIndex: number) => {
    setBlocks(prev => {
      const next = [...prev];
      next.splice(afterIndex + 1, 0, { kind: 'text', id: newId(), value: '\n' });
      return next;
    });
  };

  const updateTextBlock = (id: string, value: string) => {
    setBlocks(prev => prev.map(b => (b.kind === 'text' && b.id === id ? { ...b, value } : b)));
  };

  const reorderBlocks = (from: number, to: number) => {
    setBlocks(prev => {
      if (from < 0 || to < 0 || from >= prev.length || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  };

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
          // ✅ 이미지도 본문에 토큰([[img:n]])을 삽입하지 않고,
          //    첨부 목록(미리보기) + 게시물 표시 화면에서 자동 렌더링되도록 처리
          return [...prev, { name: file.name, data: fileData, type: file.type }];
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
    // 이미지 삭제 시 블록의 imgIndex도 정리(앞당김)
    setBlocks(prev => {
      const imagesBefore = attachments
        .filter(a => a.type?.startsWith('image/'))
        .map((_, i) => i); // [0..n-1]
      // index가 이미지인지 판단
      const isImg = attachments[index]?.type?.startsWith('image/');
      if (!isImg) return prev;

      // 삭제될 이미지의 "이미지 인덱스" 계산: attachments 중 이미지들 기준
      let removedImgIndex = -1;
      let counter = 0;
      for (let i = 0; i < attachments.length; i++) {
        if (attachments[i]?.type?.startsWith('image/')) {
          if (i === index) { removedImgIndex = counter; break; }
          counter += 1;
        }
      }
      if (removedImgIndex < 0) return prev;

      return prev
        .filter(b => !(b.kind === 'img' && b.imgIndex === removedImgIndex))
        .map(b => (b.kind === 'img' && b.imgIndex > removedImgIndex ? { ...b, imgIndex: b.imgIndex - 1 } : b));
    });
  };

  const isImageAttachment = (a: PostAttachment) => !!a.type?.startsWith('image/');

  // attachments 안에서 "이미지들만" 순서를 바꾸고, 문서(비이미지)는 그대로 뒤에 유지
  const reorderImagesInAttachments = (from: number, to: number) => {
    setAttachments(prev => {
      const images = prev.filter(isImageAttachment);
      const nonImages = prev.filter(a => !isImageAttachment(a));
      if (from < 0 || to < 0 || from >= images.length || to >= images.length) return prev;

      const nextImages = [...images];
      const [moved] = nextImages.splice(from, 1);
      nextImages.splice(to, 0, moved);

      return [...nextImages, ...nonImages];
    });
  };

  const getImageAttachments = () => attachments.filter(isImageAttachment);

  const removeImageByImgIndex = (imgIndex: number) => {
    // imgIndex는 "이미지들만" 기준 인덱스
    setAttachments(prev => {
      const images = prev.filter(isImageAttachment);
      const nonImages = prev.filter(a => !isImageAttachment(a));
      const target = images[imgIndex];
      if (!target) return prev;
      const nextImages = images.filter((_, i) => i !== imgIndex);
      return [...nextImages, ...nonImages];
    });

    setBlocks(prev => {
      const next: EditorBlock[] = [];
      for (const b of prev) {
        if (b.kind === 'img') {
          if (b.imgIndex === imgIndex) continue; // 해당 이미지 블록 제거
          if (b.imgIndex > imgIndex) next.push({ ...b, imgIndex: b.imgIndex - 1 }); // 뒤 인덱스 당김
          else next.push(b);
        } else {
          next.push(b);
        }
      }
      // 최소 1개 텍스트 블록 유지
      if (next.length === 0) return [{ kind: 'text', id: 't0', value: '' }];
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
          {!isMobile && (
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <i className="fas fa-paperclip mr-2"></i> 첨부파일 (사진 최대 5개 / 문서 최대 3개 / 총 8개)
            </label>
          )}
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
              className={`w-full text-gray-400 text-sm hover:text-sky-primary hover:bg-white transition-all rounded-lg border border-dashed border-gray-300 flex items-center justify-center ${isMobile ? "py-4 flex-col" : "py-6 flex-col"}`}
            >
              {isMobile ? (
                <>
                  <div className="flex items-center gap-2">
                    <i className="fas fa-plus-circle text-2xl"></i>
                    <span>사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES}  문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES}</span>
                  </div>
                  <div className="text-[10px] mt-1 text-sky-600 font-bold">
                    파일당 최대 {formatFileSize(MAX_FILE_SIZE)} · 총합 최대 {formatFileSize(MAX_TOTAL_SIZE)}
                  </div>
                </>
              ) : (
                <>
                  <i className="fas fa-plus-circle text-2xl mb-2"></i>
                  <span>
                    클릭하여 파일을 추가하세요 (현재 {attachments.length}/{MAX_TOTAL_FILES} · 사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES} · 문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES})
                  </span>
                  <span className="text-[10px] mt-1 text-sky-600 font-bold">
                    파일당 최대 {formatFileSize(MAX_FILE_SIZE)} · 총합 최대 {formatFileSize(MAX_TOTAL_SIZE)}
                  </span>
                </>
              )}

            </button>
          ) : (
            <p className="text-center text-xs text-orange-500 font-medium py-2">최대 파일 개수에 도달했습니다.</p>
          )}
        </div>

        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>

          <div className="border rounded-lg p-3 bg-white">
            {blocks.map((b, idx) => (
              <div
                key={b.id}
                className="mb-3 last:mb-0 border rounded-md p-2 bg-gray-50"
                draggable
                onDragStart={() => setDragBlockIndex(idx)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragBlockIndex === null) return;
                  reorderBlocks(dragBlockIndex, idx);
                  setDragBlockIndex(null);
                }}
                onDragEnd={() => setDragBlockIndex(null)}
                style={{ touchAction: 'none' }}
                title="드래그해서 위치를 바꿀 수 있어요"
              >
                {b.kind === 'text' ? (
                  <textarea
                    className="w-full min-h-[90px] p-2 border rounded bg-white"
                    value={b.value}
                    onChange={(e) => updateTextBlock(b.id, e.target.value)}
                    placeholder="내용을 입력하세요"
                  />
                ) : (
                  <div className="relative">
                    <img
                      src={getImageAttachments()[b.imgIndex]?.data || ''}
                      alt={getImageAttachments()[b.imgIndex]?.name || `img-${b.imgIndex}`}
                      className="w-full max-h-64 object-contain rounded bg-white border"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      className="absolute top-2 right-2 bg-white/90 rounded-full w-8 h-8 flex items-center justify-center text-red-500 border"
                      onClick={() => removeImageByImgIndex(b.imgIndex)}
                      aria-label="이미지 삭제"
                      title="이미지 삭제"
                    >
                      ✕
                    </button>
                    <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded">
                      이미지 {b.imgIndex + 1}
                    </div>
                  </div>
                )}

                {/* 텍스트 추가 버튼 (블록 사이에 문단 추가 가능) */}
                <div className="flex gap-2 mt-2 items-center">
                  <button
                    type="button"
                    className="text-xs px-3 py-1 rounded border bg-gray-50"
                    onClick={() => insertTextBlockAfter(idx)}
                  >
                    + 텍스트 추가
                  </button>
                  <div className="text-xs text-gray-400">블록을 드래그하면 위치가 바뀝니다</div>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex justify-end space-x-3 pt-4">
          <button onClick={onCancel} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={() => onSave(title, blocksToContent(blocks), attachments, initialPost?.id)}
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
