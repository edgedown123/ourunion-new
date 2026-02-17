
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
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);


  // 모바일: 첨부 카드 롱프레스 → 드래그로 위치 이동
  const longPressTimerRef = useRef<number | null>(null);
  const dragItemRef = useRef<HTMLElement | null>(null);
  const isDraggingRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  const getAttachItemFromTarget = (target: HTMLElement | null) => {
    if (!target) return null;
    // 버튼/아이콘을 눌러도 카드 전체를 잡을 수 있게 closest로 끌어올림
    return (target.closest('[data-attach-item="1"]') as HTMLElement | null)
      || (target.closest('img[data-img-index]') as HTMLElement | null)
      || (target.closest('[data-file-index]') as HTMLElement | null);
  };

  const getBlockNodes = (item: HTMLElement) => {
    // 카드 뒤에 붙어있는 <br/>도 함께 이동
    const nodes: Node[] = [item];
    const next = item.nextSibling as any;
    if (next && next.tagName === 'BR') nodes.push(next);
    return nodes;
  };

  const moveBlock = (dragItem: HTMLElement, targetItem: HTMLElement, before: boolean) => {
    if (dragItem === targetItem) return;
    const parent = targetItem.parentNode;
    if (!parent) return;

    const dragNodes = getBlockNodes(dragItem);
    const targetNodes = getBlockNodes(targetItem);
    const refNode = before
      ? (targetItem as any)
      : ((targetNodes[targetNodes.length - 1] as any).nextSibling as ChildNode | null);

    // 이미 같은 위치면 무시
    if (refNode === dragNodes[0]) return;

    for (const n of dragNodes) {
      if (n.parentNode) n.parentNode.removeChild(n);
    }
    for (const n of dragNodes) {
      parent.insertBefore(n, refNode);
    }
  };

  const handleEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    clearLongPressTimer();

    const target = e.target as HTMLElement | null;
    const item = getAttachItemFromTarget(target);
    if (!item) return;

    longPressTimerRef.current = window.setTimeout(() => {
      const el = getAttachItemFromTarget(target);
      if (!el) return;
      isDraggingRef.current = true;
      dragItemRef.current = el;
      el.classList.add('opacity-60');
      el.style.outline = '2px solid rgba(14,165,233,0.35)';
      el.style.borderRadius = '14px';
      // 드래그 시작 시 커서/선택 방지
      (document.body as any).style.webkitUserSelect = 'none';
      (document.body as any).style.userSelect = 'none';
    }, 420);
  };

  const stopDragging = () => {
    clearLongPressTimer();
    const cur = dragItemRef.current;
    if (cur) {
      cur.classList.remove('opacity-60');
      cur.style.outline = '';
    }
    dragItemRef.current = null;
    isDraggingRef.current = false;
    (document.body as any).style.webkitUserSelect = '';
    (document.body as any).style.userSelect = '';
  };

  const handleEditorTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    if (!isDraggingRef.current || !dragItemRef.current) return;

    // 드래그 중엔 스크롤 방지
    e.preventDefault();

    const touch = e.touches[0];
    if (!touch) return;

    const elUnder = document.elementFromPoint(touch.clientX, touch.clientY) as HTMLElement | null;
    const targetItem = getAttachItemFromTarget(elUnder);
    const dragItem = dragItemRef.current;
    if (!targetItem || targetItem === dragItem) return;

    const editorEl = editorRef.current;
    if (!editorEl || !editorEl.contains(targetItem) || !editorEl.contains(dragItem)) return;

    const tRect = targetItem.getBoundingClientRect();
    const before = touch.clientY < (tRect.top + tRect.height / 2);
    moveBlock(dragItem, targetItem, before);

    // 순서가 바뀌면 content 갱신
    setContent(serializeEditorToContent());
  };

  const handleEditorTouchEnd = () => {
    stopDragging();
  };


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

  
  const renderRawContentToEditor = (raw: string) => {
    const el = editorRef.current;
    if (!el) return;

    // 텍스트/토큰([[img:n]], [[file:n]])을 편집기 DOM으로 변환
    const safeRaw = raw == null ? '' : String(raw);
    const parts = safeRaw.split(/\[\[(img|file):(\d+)\]\]/g);

    const escapeHtml = (s: string) =>
      s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const html: string[] = [];
    for (let i = 0; i < parts.length; ) {
      const text = parts[i++] ?? '';
      if (text) html.push(escapeHtml(text).replace(/\n/g, '<br/>'));

      const kind = parts[i];
      const idx = parts[i + 1];
      if (kind && idx != null) {
        if (kind === 'img') {
          html.push(
            `<div data-attach-item="1" data-attach-kind="img" contenteditable="false" style="position:relative;max-width:100%;margin:10px 0;">
              <button type="button" data-attach-delete="img" data-img-index="${idx}" style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:999px;border:none;background:rgba(0,0,0,0.55);color:white;font-weight:900;line-height:26px;text-align:center;z-index:2;">×</button>
              <img data-attach-kind="img" data-img-index="${idx}" style="max-width:100%;border-radius:10px;display:block;" />
            </div>`
          );
          html.push('<br/>');
        } else if (kind === 'file') {
          html.push(
            `<div data-attach-item="1" data-attach-kind="file" data-file-index="${idx}" contenteditable="false" style="position:relative;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:14px;background:#fff;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,0.04);">
              <button type="button" data-attach-delete="file" data-file-index="${idx}" style="position:absolute;top:6px;right:6px;width:26px;height:26px;border-radius:999px;border:none;background:rgba(0,0,0,0.55);color:white;font-weight:900;line-height:26px;text-align:center;">×</button>
              <div style="width:38px;height:38px;border-radius:10px;background:#f3f4f6;display:flex;align-items:center;justify-content:center;font-size:18px;">📎</div>
              <div data-file-name="1" style="font-weight:700;font-size:14px;color:#111827;word-break:break-all;padding-right:34px;">첨부파일</div>
            </div>`
          );
          html.push('<br/>');
        }
        i += 2;
      } else {
        break;
      }
    }

    el.innerHTML = html.join('');
    syncEditorImagesFromAttachments();
    syncEditorFilesFromAttachments();
    setContent(serializeEditorToContent());
  };

useEffect(() => {
    if (initialPost) {
      setTitle(initialPost.title);
      setAttachments(initialPost.attachments || []);
      requestAnimationFrame(() => {
        renderRawContentToEditor(initialPost.content || '');
      });
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

  const isImageAttachment = (a: PostAttachment) => !!a.type?.startsWith('image/');
  const getImageAttachments = () => attachments.filter(isImageAttachment);
const isDocAttachment = (a: PostAttachment) => !isImageAttachment(a);
  const getDocAttachments = () => attachments.filter(isDocAttachment);

  const syncEditorFilesFromAttachments = () => {
    const el = editorRef.current;
    if (!el) return;
    const nodes = Array.from(el.querySelectorAll('[data-file-index]')) as HTMLElement[];
    const docs = getDocAttachments();
    for (const n of nodes) {
      const idx = Number(n.getAttribute('data-file-index') || '-1');
      const nameEl = n.querySelector('[data-file-name]') as HTMLElement | null;
      const name = docs[idx]?.name || '첨부파일';
      if (nameEl) nameEl.textContent = name;
      else n.textContent = name;
    }
  };

const removeFileByDocIndex = (docIndex: number) => {
    setAttachments(prev => {
      const images = prev.filter(isImageAttachment);
      const docs = prev.filter(isDocAttachment);
      if (docIndex < 0 || docIndex >= docs.length) return prev;
      const nextDocs = docs.filter((_, i) => i !== docIndex);
      return [...images, ...nextDocs];
    });

    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll('[data-file-index]')) as HTMLElement[];
      for (const n of nodes) {
        const idx = Number(n.getAttribute('data-file-index') || '-1');
        if (idx === docIndex) n.remove();
        else if (idx > docIndex) {
          const nextIdx = String(idx - 1);
          n.setAttribute('data-file-index', nextIdx);
          const btn = n.querySelector('button[data-attach-delete="file"]') as HTMLButtonElement | null;
          if (btn) btn.setAttribute('data-file-index', nextIdx);
        }
      }
      syncEditorFilesFromAttachments();
      setContent(serializeEditorToContent());
    });
  };

const insertFileIntoEditor = (docIndex: number) => {
    const el = editorRef.current;
    if (!el) return;

    const card = document.createElement('div');
    card.setAttribute('data-attach-item', '1');
    card.setAttribute('data-file-index', String(docIndex));
    card.setAttribute('data-attach-kind', 'file');
    card.setAttribute('contenteditable', 'false');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.gap = '10px';
    card.style.padding = '12px 14px';
    card.style.border = '1px solid #e5e7eb';
    card.style.borderRadius = '14px';
    card.style.background = '#fff';
    card.style.margin = '10px 0';
    card.style.boxShadow = '0 1px 2px rgba(0,0,0,0.04)';
    card.style.position = 'relative';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.setAttribute('data-attach-delete', 'file');
    delBtn.setAttribute('data-file-index', String(docIndex));
    delBtn.style.position = 'absolute';
    delBtn.style.top = '6px';
    delBtn.style.right = '6px';
    delBtn.style.width = '26px';
    delBtn.style.height = '26px';
    delBtn.style.borderRadius = '999px';
    delBtn.style.border = 'none';
    delBtn.style.background = 'rgba(0,0,0,0.55)';
    delBtn.style.color = 'white';
    delBtn.style.fontWeight = '900';
    delBtn.style.lineHeight = '26px';
    delBtn.style.textAlign = 'center';
    delBtn.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeFileByDocIndex(docIndex);
    });

    const icon = document.createElement('div');
    icon.style.width = '38px';
    icon.style.height = '38px';
    icon.style.borderRadius = '10px';
    icon.style.background = '#f3f4f6';
    icon.style.display = 'flex';
    icon.style.alignItems = 'center';
    icon.style.justifyContent = 'center';
    icon.style.fontSize = '18px';
    icon.textContent = '📎';

    const name = document.createElement('div');
    name.setAttribute('data-file-name', '1');
    name.style.fontWeight = '700';
    name.style.fontSize = '14px';
    name.style.color = '#111827';
    name.style.wordBreak = 'break-all';
    name.style.paddingRight = '34px';
    name.textContent = getDocAttachments()[docIndex]?.name || '첨부파일';

    card.appendChild(delBtn);
    card.appendChild(icon);
    card.appendChild(name);

    // 데스크톱: 클릭 삭제
    card.addEventListener('click', () => {
      if (isMobile) return;
      if (confirm('이 파일을 삭제할까요?')) removeFileByDocIndex(docIndex);
    });

    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        el.appendChild(card);
        el.appendChild(document.createElement('br'));
      } else {
        range.deleteContents();
        range.insertNode(card);
        range.collapse(false);
        range.insertNode(document.createElement('br'));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      el.appendChild(card);
      el.appendChild(document.createElement('br'));
    }

    setContent(serializeEditorToContent());
  };


  const serializeEditorToContent = (): string => {
    const el = editorRef.current;
    if (!el) return '';

    const out: string[] = [];

    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        out.push((node as Text).data);
        return;
      }
      if (node.nodeType !== Node.ELEMENT_NODE) return;

      const elem = node as HTMLElement;
      const tag = elem.tagName;


      // 삭제 버튼 텍스트가 본문에 섞이지 않도록 무시
      if (tag === 'BUTTON' && elem.hasAttribute('data-attach-delete')) {
        return;
      }

      // 이미지 카드 래퍼(div)인 경우: 내부 img의 인덱스로 토큰 출력
      if (elem.getAttribute('data-attach-kind') === 'img' && elem.getAttribute('data-attach-item') === '1') {
        const inner = elem.querySelector('img[data-img-index]') as HTMLElement | null;
        const idx = inner?.getAttribute('data-img-index') || '';
        if (idx) {
          out.push(`[[img:${idx}]]
`);
          return;
        }
      }

      if (tag === 'BR') {
        out.push('\n');
        return;
      }

      // 이미지 토큰
      if (tag === 'IMG' && elem.hasAttribute('data-img-index')) {
        const idx = elem.getAttribute('data-img-index') || '';
        out.push(`[[img:${idx}]]\n`);
        return;
      }

      // 파일 토큰 (문서 등)
      if (elem.hasAttribute('data-file-index')) {
        const idx = elem.getAttribute('data-file-index') || '';
        out.push(`[[file:${idx}]]\n`);
        return;
      }

      // 블록 요소는 줄바꿈을 적당히 넣어줌
      const isBlock =
        tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'UL' || tag === 'OL' || tag === 'SECTION';

      if (isBlock) out.push('\n');
      for (const child of Array.from(elem.childNodes)) walk(child);

      if (isBlock) out.push('\n');
    };

    for (const child of Array.from(el.childNodes)) walk(child);

    let text = out.join('');

    // 정리
    text = text
      .replace(/\r/g, '')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    return text;
  };


  const syncEditorImagesFromAttachments = () => {
    const el = editorRef.current;
    if (!el) return;
    const imgs = Array.from(el.querySelectorAll('img[data-img-index]')) as HTMLImageElement[];
    const imageAtts = getImageAttachments();
    for (const node of imgs) {
      const idx = Number(node.getAttribute('data-img-index') || '-1');
      if (!Number.isFinite(idx) || idx < 0) continue;
      const data = imageAtts[idx]?.data;
      if (data) node.src = data;
    }
  };


  useEffect(() => {
    // 첨부 상태 변경 시(추가/삭제/수정) 편집기 내 미리보기 갱신
    requestAnimationFrame(() => {
      syncEditorImagesFromAttachments();
      syncEditorFilesFromAttachments();
    });
  }, [attachments]);

  const removeImageByImgIndex = (imgIndex: number) => {
    setAttachments(prev => {
      const images = prev.filter(isImageAttachment);
      const nonImages = prev.filter(a => !isImageAttachment(a));
      if (imgIndex < 0 || imgIndex >= images.length) return prev;
      const nextImages = images.filter((_, i) => i !== imgIndex);
      return [...nextImages, ...nonImages];
    });

    requestAnimationFrame(() => {
      const el = editorRef.current;
      if (!el) return;
      const nodes = Array.from(el.querySelectorAll('img[data-img-index]')) as HTMLImageElement[];
      for (const img of nodes) {
        const idx = Number(img.getAttribute('data-img-index') || '-1');
        const wrapper = (img.closest('[data-attach-kind="img"][data-attach-item="1"]') as HTMLElement | null);
        const container = wrapper || (img as any);
        if (idx === imgIndex) {
          container.remove();
        } else if (idx > imgIndex) {
          const nextIdx = String(idx - 1);
          img.setAttribute('data-img-index', nextIdx);
          const btn = wrapper?.querySelector('button[data-attach-delete="img"]') as HTMLButtonElement | null;
          if (btn) btn.setAttribute('data-img-index', nextIdx);
        }
      }
      syncEditorImagesFromAttachments();
      setContent(serializeEditorToContent());
    });
  };

  

  

  


  // 편집기 내부(HTML로 렌더링된 카드)의 삭제 버튼은 이벤트 위임으로 처리
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;

    const onClick = (ev: MouseEvent) => {
      const target = ev.target as HTMLElement | null;
      const btn = target?.closest('button[data-attach-delete]') as HTMLButtonElement | null;
      if (!btn) return;
      ev.preventDefault();
      ev.stopPropagation();

      const kind = btn.getAttribute('data-attach-delete');
      if (kind === 'img') {
        const idx = Number(btn.getAttribute('data-img-index') || '-1');
        if (Number.isFinite(idx) && idx >= 0) removeImageByImgIndex(idx);
      } else if (kind === 'file') {
        const idx = Number(btn.getAttribute('data-file-index') || '-1');
        if (Number.isFinite(idx) && idx >= 0) removeFileByDocIndex(idx);
      }
    };

    el.addEventListener('click', onClick);
    return () => el.removeEventListener('click', onClick);
  }, [attachments, isMobile]);

const insertImageIntoEditor = (imgIndex: number, dataOverride?: string) => {
    const el = editorRef.current;
    if (!el) return;
    const imgData = dataOverride || getImageAttachments()[imgIndex]?.data;
    if (!imgData) return;

    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-attach-item', '1');
    wrapper.setAttribute('data-attach-kind', 'img');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.setAttribute('draggable', 'true');
    wrapper.style.position = 'relative';
    wrapper.style.maxWidth = '100%';
    wrapper.style.margin = '10px 0';

    const del = document.createElement('button');
    del.type = 'button';
    del.textContent = '×';
    del.setAttribute('data-attach-delete', 'img');
    del.setAttribute('data-img-index', String(imgIndex));
    del.style.position = 'absolute';
    del.style.top = '6px';
    del.style.right = '6px';
    del.style.width = '26px';
    del.style.height = '26px';
    del.style.borderRadius = '999px';
    del.style.border = 'none';
    del.style.background = 'rgba(0,0,0,0.55)';
    del.style.color = 'white';
    del.style.fontWeight = '900';
    del.style.lineHeight = '26px';
    del.style.textAlign = 'center';
    del.style.zIndex = '2';

    const img = document.createElement('img');
    img.src = imgData;
    img.setAttribute('data-attach-kind', 'img');
    img.setAttribute('data-img-index', String(imgIndex));
    img.style.maxWidth = '100%';
    img.style.borderRadius = '10px';
    img.style.display = 'block';

    wrapper.appendChild(del);
    wrapper.appendChild(img);

    // 데스크톱 드래그(기존 사용성 유지)
    wrapper.addEventListener('dragstart', (e) => {
      (e.dataTransfer as DataTransfer).setData('text/plain', String(imgIndex));
      (e.dataTransfer as DataTransfer).effectAllowed = 'move';
      wrapper.classList.add('opacity-60');
    });
    wrapper.addEventListener('dragend', () => wrapper.classList.remove('opacity-60'));

    // 데스크톱: 카드 클릭 삭제(기존 동작 유지)
    wrapper.addEventListener('click', (ev) => {
      if (isMobile) return;
      const t = ev.target as HTMLElement | null;
      if (t?.closest('button[data-attach-delete="img"]')) return;
      if (confirm('이 이미지를 삭제할까요?')) {
        removeImageByImgIndex(imgIndex);
      }
    });

    // 버튼은 이벤트 위임으로도 처리하지만, 여기선 즉시 반응 보장
    del.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      removeImageByImgIndex(imgIndex);
    });

    const sel = window.getSelection?.();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (!el.contains(range.startContainer)) {
        el.appendChild(wrapper);
        el.appendChild(document.createElement('br'));
      } else {
        range.deleteContents();
        range.insertNode(wrapper);
        range.collapse(false);
        range.insertNode(document.createElement('br'));
        range.collapse(false);
        sel.removeAllRanges();
        sel.addRange(range);
      }
    } else {
      el.appendChild(wrapper);
      el.appendChild(document.createElement('br'));
    }

    setContent(serializeEditorToContent());
  };

  const handleEditorDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const el = editorRef.current;
    if (!el) return;
    const fromIndex = Number(e.dataTransfer.getData('text/plain'));
    if (!Number.isFinite(fromIndex) || fromIndex < 0) return;

    // 가장 가까운 img를 찾고 그 앞에 삽입
    const target = (e.target as HTMLElement).closest('[data-attach-kind="img"][data-attach-item="1"]') as HTMLElement | null;
    const dragged = (el.querySelector('img[data-img-index= + String(fromIndex) + ]') as HTMLElement | null)?.closest('[data-attach-kind="img"][data-attach-item="1"]') as HTMLElement | null;
    if (!dragged) return;

    if (target && dragged && target !== dragged) {
      // dragged 다음 br도 함께 이동
      const dragBr = (dragged.nextSibling as any)?.tagName === 'BR' ? dragged.nextSibling : null;
      const ref = target;
      target.parentNode?.insertBefore(dragged, ref);
      if (dragBr) target.parentNode?.insertBefore(dragBr, dragged.nextSibling);
      // 줄바꿈 보정
      if (dragged.nextSibling && (dragged.nextSibling as any).tagName !== 'BR') {
        dragged.parentNode?.insertBefore(document.createElement('br'), dragged.nextSibling);
      }
    }
    setContent(serializeEditorToContent());
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
          const prevImages = prev.filter(p => p.type?.startsWith('image/'));
          const prevDocs = prev.filter(p => !p.type?.startsWith('image/'));

          const isImg = file.type?.startsWith('image/');
          const imageIndex = isImg ? prevImages.length : -1;
          const docIndex = !isImg ? prevDocs.length : -1;

          const nextImages = isImg ? [...prevImages, { name: file.name, data: fileData, type: file.type }] : prevImages;
          const nextDocs = !isImg ? [...prevDocs, { name: file.name, data: fileData, type: file.type }] : prevDocs;

          // ✅ 본문 편집기 커서 위치에 미리보기(이미지) / 파일 카드(문서) 삽입
          editorRef.current?.focus?.();
          if (imageIndex >= 0) {
            requestAnimationFrame(() => insertImageIntoEditor(imageIndex, fileData));
          } else if (docIndex >= 0) {
            requestAnimationFrame(() => insertFileIntoEditor(docIndex));
          }

          return [...nextImages, ...nextDocs];
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
          {!isMobile && (
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
                <button onClick={() => removeAttachment(idx)} className="text-red-400 hover:text-red-600">
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {isMobile && (
          <div className="mb-3 text-xs text-gray-500">
            첨부: 사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES} · 문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES}
            <span className="ml-2 text-gray-400">(길게 눌러 드래그 이동 · X로 삭제)</span>
          </div>
        )}

        {isMobile && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click?.()}
            className="w-full py-3 rounded-xl bg-white border font-bold text-gray-700 flex items-center justify-center gap-2"
          >
            <i className="fas fa-paperclip"></i>
            파일/사진 첨부하기
          </button>
        )}
</div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
          <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setContent(serializeEditorToContent())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleEditorDrop}
                onTouchStart={handleEditorTouchStart}
                onTouchMove={handleEditorTouchMove}
                onTouchEnd={handleEditorTouchEnd}
                onTouchCancel={handleEditorTouchEnd}
                className="w-full min-h-[260px] p-4 border rounded-lg bg-white focus:outline-none"
                style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
              />
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
