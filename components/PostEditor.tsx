
import React, { useState, useRef, useEffect  } from 'react';
import { BoardType, PostAttachment, Post } from '../types';


const OBITUARY_TAG_START = '[[obituary]]';
const OBITUARY_TAG_END = '[[/obituary]]';

type ObituaryFormData = {
  kind: 'obituary';
  deceasedName: string;
  memberName?: string;
  relation?: string;
  bereaved?: string;
  deathDate?: string;
  funeralDate?: string;
  burialPlace?: string;
  hallName?: string;
  hallRoom?: string;
  hallAddress?: string;
  contact?: string;
  account?: string;
  notice?: string;
};

const buildObituaryContent = (data: ObituaryFormData) => {
  return `${OBITUARY_TAG_START}
${JSON.stringify(data)}
${OBITUARY_TAG_END}`;
};

const tryParseObituaryContent = (content: string): ObituaryFormData | null => {
  if (!content) return null;
  const s = content.indexOf(OBITUARY_TAG_START);
  const e = content.indexOf(OBITUARY_TAG_END);
  if (s === -1 || e === -1 || e <= s) return null;
  const jsonText = content.slice(s + OBITUARY_TAG_START.length, e).trim();
  try {
    const obj = JSON.parse(jsonText);
    if (obj?.kind === 'obituary') return obj as ObituaryFormData;
  } catch {}
  return null;
};


// datetime-local 입력용 값으로 정규화 (기존 문자열 형태도 최대한 복원)
// 값에서 날짜(YYYY-MM-DD)만 최대한 추출
const toISODateValue = (value?: string) => {
  if (!value) return '';

  // ISO datetime / datetime-local / "YYYY-MM-DD ..." 형태
  const m = value.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;

  // 마지막 fallback: Date 파싱이 되면 ISO 날짜로 변환
  const d = new Date(value);
  if (!isNaN(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }
  return '';
};

type WheelDatePickerProps = {
  value?: string; // YYYY-MM-DD
  onChange: (next: string) => void;
  placeholder?: string;
};

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const weekdayKo = (date: Date) => {
  const map = ['일', '월', '화', '수', '목', '금', '토'] as const;
  return map[date.getDay()];
};

const formatKoreanDateWithWeekday = (yyyy: number, mm: number, dd: number) => {
  const dt = new Date(yyyy, mm - 1, dd);
  return `${String(yyyy)}년 ${String(mm).padStart(2, '0')}월 ${String(dd).padStart(2, '0')}일 (${weekdayKo(dt)})`;
};

const formatISOWithWeekday = (iso: string) => {
  const m = iso.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  const yyyy = Number(m[1]);
  const mm = Number(m[2]);
  const dd = Number(m[3]);
  const dt = new Date(yyyy, mm - 1, dd);
  return `${m[0]} (${weekdayKo(dt)})`;
};

const daysInMonth = (year: number, month: number) => new Date(year, month, 0).getDate(); // month: 1-12

// iOS 느낌의 "휠" 날짜 선택기 (모바일/데스크톱 공통)
const WheelDatePicker: React.FC<WheelDatePickerProps> = ({ value, onChange, placeholder = '년-월-일' }) => {
  const [open, setOpen] = useState(false);

  const today = new Date();
  const baseYear = today.getFullYear();
  const minYear = 2025;
  const maxYear = 2100;
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i);
  const months = Array.from({ length: 12 }, (_, i) => i + 1);

  const parsed = (() => {
    const v = toISODateValue(value);
    const m = v.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (!m) return { y: clamp(baseYear, minYear, maxYear), mo: today.getMonth() + 1, d: today.getDate() };
    return { y: clamp(Number(m[1]), minYear, maxYear), mo: Number(m[2]), d: Number(m[3]) };
  })();

  const [y, setY] = useState(parsed.y);
  const [mo, setMo] = useState(parsed.mo);
  const [d, setD] = useState(parsed.d);

  // 열릴 때 현재 값으로 맞추기
  useEffect(() => {
    if (!open) return;
    setY(parsed.y);
    setMo(parsed.mo);
    setD(parsed.d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // 월/년도 변경 시 날짜 보정
  useEffect(() => {
    const maxD = daysInMonth(y, mo);
    if (d > maxD) setD(maxD);
  }, [y, mo]);

  const maxD = daysInMonth(y, mo);
  const days = Array.from({ length: maxD }, (_, i) => i + 1);

  const displayISO = value ? toISODateValue(value) : '';
  const display = displayISO ? formatISOWithWeekday(displayISO) : '';

  const commit = () => {
    const yyyy = String(y).padStart(4, '0');
    const mm = String(mo).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    onChange(`${yyyy}-${mm}-${dd}`);
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setOpen(false);
  };

  const WheelCol: React.FC<{
    items: number[];
    selected: number;
    onSelect: (v: number) => void;
    format?: (v: number) => string;
  }> = ({ items, selected, onSelect, format }) => {
    const ref = useRef<HTMLDivElement | null>(null);
    const rowH = 36; // px
    const pad = 72; // (rowH*2) -> center highlight
    const isProgrammatic = useRef(false);

    // 스크롤을 선택값에 맞춤
    useEffect(() => {
      if (!ref.current) return;
      const idx = Math.max(0, items.indexOf(selected));
      isProgrammatic.current = true;
      ref.current.scrollTo({ top: idx * rowH, behavior: 'auto' });
      const t = setTimeout(() => (isProgrammatic.current = false), 120);
      return () => clearTimeout(t);
    }, [selected, items.join(',')]);

        const scrollEndTimer = useRef<number | null>(null);

    const snapToNearest = (behavior: ScrollBehavior = 'smooth') => {
      if (!ref.current) return;
      const idx = clamp(Math.round(ref.current.scrollTop / rowH), 0, items.length - 1);
      isProgrammatic.current = true;
      ref.current.scrollTo({ top: idx * rowH, behavior });
      onSelect(items[idx]);
      window.setTimeout(() => (isProgrammatic.current = false), 180);
    };

    const onScroll = () => {
      if (!ref.current) return;
      if (isProgrammatic.current) return;

      // 스크롤 중엔 값 업데이트를 강하게 하지 않고,
      // 스크롤이 멈췄을 때 가장 가까운 항목으로 스르륵 스냅
      if (scrollEndTimer.current) window.clearTimeout(scrollEndTimer.current);
      scrollEndTimer.current = window.setTimeout(() => {
        snapToNearest('smooth');
      }, 90);
    };

    return (
      <div className="relative">
        {/* iOS 느낌: 위/아래 페이드 */}
        <div className="pointer-events-none absolute left-0 right-0 top-0 h-[72px] bg-gradient-to-b from-white via-white/70 to-transparent rounded-t-lg" />
        <div className="pointer-events-none absolute left-0 right-0 bottom-0 h-[72px] bg-gradient-to-t from-white via-white/70 to-transparent rounded-b-lg" />
      <div
        ref={ref}
        onScroll={onScroll}
        className="relative h-[180px] overflow-y-scroll"
        style={{
          scrollSnapType: 'y mandatory',
          scrollSnapStop: 'always',
          paddingTop: pad,
          paddingBottom: pad,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain',
        }}
      >
        {items.map((it, idx) => {
          const selIdx = Math.max(0, items.indexOf(selected));
          const dist = Math.abs(idx - selIdx);
          const base = "h-[36px] flex items-center justify-center text-[18px] transition-[opacity,filter,font-weight,color] duration-150";
          const selectedCls = dist === 0 ? "font-bold text-gray-900" : "font-normal text-gray-600";
          const fadeCls =
            dist === 0 ? "opacity-100 blur-0" :
            dist === 1 ? "opacity-70 blur-0" :
            dist === 2 ? "opacity-40 blur-[0.5px]" :
            "opacity-20 blur-[1px]";
          return (
            <div
              key={it}
              className={`${base} ${selectedCls} ${fadeCls}`}
              style={{ scrollSnapAlign: 'center' }}
            >
              {format ? format(it) : String(it).padStart(2, '0')}
            </div>
          );
        })}
      </div>
      </div>
    );
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full rounded-2xl border p-3 text-left"
      >
        {display ? display : <span className="text-gray-400">{placeholder}</span>}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="relative w-full sm:w-[420px] bg-white rounded-t-2xl sm:rounded-2xl shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <button type="button" className="text-sm text-gray-500" onClick={clear}>
                지우기
              </button>
              <div className="text-sm font-bold">날짜 선택</div>
              <button type="button" className="text-sm font-bold" onClick={commit}>
                확인
              </button>
            </div>

            <div className="px-4 py-6">
              <div className="relative">
                {/* 가운데 선택 하이라이트 (휠 영역 기준으로 정확히 중앙) */}
                <div className="pointer-events-none absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[36px] rounded-lg bg-gray-100/80 border" />
                <div className="grid grid-cols-3 gap-2">
                  <WheelCol items={years} selected={y} onSelect={setY} format={(v) => String(v)} />
                  <WheelCol items={months} selected={mo} onSelect={setMo} />
                  <WheelCol items={days} selected={d} onSelect={setD} />
                </div>
              </div>
              <div className="mt-3 text-center text-xs text-gray-500">
                {formatKoreanDateWithWeekday(y, mo, d)}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface PostEditorProps {
  type: BoardType;
  initialPost?: Post | null;
  onSave: (title: string, content: string, attachments?: PostAttachment[], id?: string) => void;
  onCancel: () => void;
}

const PostEditor: React.FC<PostEditorProps> = ({ type, initialPost, onSave, onCancel }) => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  
  const [template, setTemplate] = useState<'normal' | 'obituary'>('normal');
  const [obituary, setObituary] = useState<ObituaryFormData>({
    kind: 'obituary',
    deceasedName: '',
    memberName: '',
    relation: '',
    bereaved: '',
    deathDate: '',
    funeralDate: '',
    burialPlace: '',
    hallName: '',
    hallRoom: '',
    hallAddress: '',
    contact: '',
    account: '',
    notice: '',
  });
const editorRef = useRef<HTMLDivElement | null>(null);
  const [attachments, setAttachments] = useState<PostAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const longPressTimerRef = useRef<number | null>(null);
  const [fileOpenSheet, setFileOpenSheet] = useState<{ docIndex: number } | null>(null);
  const [imageOpenSheet, setImageOpenSheet] = useState<{ imgIndex: number } | null>(null);
  const [imageViewerUrl, setImageViewerUrl] = useState<string | null>(null);

  // 이미지 확대/줌(핀치줌/휠줌)
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const lastDistRef = useRef<number | null>(null);
  const panStartRef = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    if (imageViewerUrl) {
      setImgScale(1);
      setImgOffset({ x: 0, y: 0 });
      pointersRef.current.clear();
      lastDistRef.current = null;
      panStartRef.current = null;
    }
  }, [imageViewerUrl]);

  // --- Reorder (mobile: long-press + touch drag, desktop: mouse drag) ---
  const dragRef = useRef<{ active: boolean; node: HTMLElement | null; placeholder: HTMLElement | null; touchId: number | null; startY: number; offsetY: number; startX: number; offsetX: number; mode: 'touch' | 'mouse' | null; }>({ active: false, node: null, placeholder: null, touchId: null, startY: 0, offsetY: 0, startX: 0, offsetX: 0, mode: null });

  const mousePendingRef = useRef<{ down: boolean; startX: number; startY: number; target: HTMLElement | null }>({ down: false, startX: 0, startY: 0, target: null });

  const cleanupDrag = () => {
    const st = dragRef.current;
    if (!st.active) return;
    st.active = false;
    try {
      window.removeEventListener('touchmove', onWindowTouchMove as any);
      window.removeEventListener('touchend', onWindowTouchEnd as any);
      window.removeEventListener('touchcancel', onWindowTouchEnd as any);
      window.removeEventListener('mousemove', onWindowMouseMove as any);
      window.removeEventListener('mouseup', onWindowMouseUp as any);
    } catch {}

    // restore body scroll / selection
    document.body.style.overflow = '';
    (document.body.style as any).userSelect = '';

    const node = st.node;
    const ph = st.placeholder;
    if (node) {
      node.classList.remove('ring-2', 'ring-sky-400');
      node.style.position = '';
      node.style.left = '';
      node.style.top = '';
      node.style.width = '';
      node.style.zIndex = '';
      node.style.transform = '';
      node.style.pointerEvents = '';
    }
    if (node && ph && ph.parentNode) {
      ph.parentNode.insertBefore(node, ph);
      ph.remove();
    } else if (ph) {
      ph.remove();
    }

    st.node = null;
    st.placeholder = null;
    st.touchId = null;
    st.mode = null;

    // persist new order in editor content
    setContent(serializeEditorToContent());
  };

  const cleanupMousePending = () => {
    const p = mousePendingRef.current;
    if (!p.down) return;
    p.down = false;
    p.target = null;
    try {
      window.removeEventListener('mousemove', onWindowMouseMovePending as any);
      window.removeEventListener('mouseup', onWindowMouseUpPending as any);
    } catch {}
  };

  const getTouchById = (e: TouchEvent, id: number | null) => {
    if (id == null) return e.touches[0] || e.changedTouches[0] || null;
    for (const t of Array.from(e.touches)) if (t.identifier === id) return t;
    for (const t of Array.from(e.changedTouches)) if (t.identifier === id) return t;
    return null;
  };

  const onWindowTouchMove = (e: TouchEvent) => {
    const st = dragRef.current;
    if (!st.active || !st.node) return;
    const t = getTouchById(e, st.touchId);
    if (!t) return;
    e.preventDefault();

    const y = t.clientY;
    const x = t.clientX;

    // move dragged node
    const top = y - st.offsetY;
    st.node.style.top = `${top}px`;

    // find target element under finger
    const elUnder = document.elementFromPoint(x, y) as HTMLElement | null;
    const target = elUnder?.closest('img[data-img-index], [data-file-index]') as HTMLElement | null;
    if (!target) return;
    if (target === st.node) return;

    const ph = st.placeholder;
    if (!ph || !target.parentNode) return;

    const rect = target.getBoundingClientRect();
    const before = y < rect.top + rect.height / 2;
    if (before) {
      target.parentNode.insertBefore(ph, target);
    } else {
      target.parentNode.insertBefore(ph, target.nextSibling);
    }
  };

  const onWindowMouseMove = (e: MouseEvent) => {
    const st = dragRef.current;
    if (!st.active || !st.node) return;
    e.preventDefault();
    const x = e.clientX;
    const y = e.clientY;

    st.node.style.left = `${x - st.offsetX}px`;
    st.node.style.top = `${y - st.offsetY}px`;

    const elUnder = document.elementFromPoint(x, y) as HTMLElement | null;
    const target = elUnder?.closest('img[data-img-index], [data-file-index]') as HTMLElement | null;
    if (!target) return;
    if (target === st.node) return;

    const ph = st.placeholder;
    if (!ph || !target.parentNode) return;

    const rect = target.getBoundingClientRect();
    const before = y < rect.top + rect.height / 2;
    if (before) {
      target.parentNode.insertBefore(ph, target);
    } else {
      target.parentNode.insertBefore(ph, target.nextSibling);
    }
  };

  const onWindowMouseUp = (_e: MouseEvent) => {
    cleanupDrag();
  };

  const onWindowTouchEnd = (_e: TouchEvent) => {
    cleanupDrag();
  };

  const startDragFromTarget = (target: HTMLElement, touch: React.Touch) => {
    const node = target.closest('img[data-img-index], [data-file-index]') as HTMLElement | null;
    const editor = editorRef.current;
    if (!node || !editor) return;

    // create placeholder with same size
    const r = node.getBoundingClientRect();
    const ph = document.createElement('div');
    ph.style.height = `${r.height}px`;
    ph.style.margin = '6px 0';
    ph.style.borderRadius = '12px';
    ph.style.border = '2px dashed rgba(148,163,184,0.8)';
    ph.style.background = 'rgba(148,163,184,0.08)';

    node.parentNode?.insertBefore(ph, node);

    // lift node
    node.classList.add('ring-2', 'ring-sky-400');
    node.style.position = 'fixed';
    node.style.left = `${r.left}px`;
    node.style.top = `${r.top}px`;
    node.style.width = `${r.width}px`;
    node.style.zIndex = '9999';
    node.style.transform = 'scale(1.02)';
    node.style.pointerEvents = 'none';

    // disable page scroll while dragging (stability first)
    document.body.style.overflow = 'hidden';

    const st = dragRef.current;
    st.active = true;
    st.node = node;
    st.placeholder = ph;
    st.touchId = touch.identifier;
    st.startY = touch.clientY;
    st.offsetY = touch.clientY - r.top;
    st.startX = touch.clientX;
    st.offsetX = touch.clientX - r.left;
    st.mode = 'touch';

    window.addEventListener('touchmove', onWindowTouchMove as any, { passive: false });
    window.addEventListener('touchend', onWindowTouchEnd as any);
    window.addEventListener('touchcancel', onWindowTouchEnd as any);
  };

  const startMouseDragFromTarget = (target: HTMLElement, clientX: number, clientY: number) => {
    const node = target.closest('img[data-img-index], [data-file-index]') as HTMLElement | null;
    const editor = editorRef.current;
    if (!node || !editor) return;

    const r = node.getBoundingClientRect();
    const ph = document.createElement('div');
    ph.style.height = `${r.height}px`;
    ph.style.margin = '6px 0';
    ph.style.borderRadius = '12px';
    ph.style.border = '2px dashed rgba(148,163,184,0.8)';
    ph.style.background = 'rgba(148,163,184,0.08)';

    node.parentNode?.insertBefore(ph, node);

    node.classList.add('ring-2', 'ring-sky-400');
    node.style.position = 'fixed';
    node.style.left = `${r.left}px`;
    node.style.top = `${r.top}px`;
    node.style.width = `${r.width}px`;
    node.style.zIndex = '9999';
    node.style.transform = 'scale(1.02)';
    node.style.pointerEvents = 'none';

    // disable scroll + text selection while dragging (stability)
    document.body.style.overflow = 'hidden';
    (document.body.style as any).userSelect = 'none';

    const st = dragRef.current;
    st.active = true;
    st.node = node;
    st.placeholder = ph;
    st.touchId = null;
    st.startX = clientX;
    st.startY = clientY;
    st.offsetX = clientX - r.left;
    st.offsetY = clientY - r.top;
    st.mode = 'mouse';

    window.addEventListener('mousemove', onWindowMouseMove as any);
    window.addEventListener('mouseup', onWindowMouseUp as any);
  };

  const handleEditorTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement | null;
    // 첨부 요소에서만 롱프레스 동작
    if (!target?.closest('img[data-img-index], [data-file-index]')) return;

    // 이미 드래그 중이면 무시
    if (dragRef.current.active) return;

    const t = e.touches[0];
    if (!t) return;

    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);

    const startX = t.clientX;
    const startY = t.clientY;

    longPressTimerRef.current = window.setTimeout(() => {
      // 롱프레스 후 드래그 시작
      startDragFromTarget(target, t);
    }, 400);

    // 롱프레스 전에 손가락이 움직이면(스크롤/탭) 타이머 취소
    const cancelOnMove = (ev: TouchEvent) => {
      const st = ev.touches[0];
      if (!st) return;
      const dx = Math.abs(st.clientX - startX);
      const dy = Math.abs(st.clientY - startY);
      if (dx + dy > 10) {
        if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
        window.removeEventListener('touchmove', cancelOnMove as any);
      }
    };
    window.addEventListener('touchmove', cancelOnMove as any, { passive: true });
  };

  const handleEditorTouchEnd = () => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
    // 손을 떼면 드래그 종료
    if (dragRef.current.active) cleanupDrag();
  };

  const onWindowMouseMovePending = (e: MouseEvent) => {
    const p = mousePendingRef.current;
    if (!p.down) return;
    const dx = Math.abs(e.clientX - p.startX);
    const dy = Math.abs(e.clientY - p.startY);
    if (dx + dy > 6) {
      const target = p.target;
      cleanupMousePending();
      if (target) startMouseDragFromTarget(target, e.clientX, e.clientY);
    }
  };

  const onWindowMouseUpPending = (_e: MouseEvent) => {
    cleanupMousePending();
  };

  const handleEditorMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isMobile) return;
    if (e.button !== 0) return;
    if (dragRef.current.active) return;

    const target = e.target as HTMLElement | null;
    if (!target?.closest('img[data-img-index], [data-file-index]')) return;

    mousePendingRef.current.down = true;
    mousePendingRef.current.startX = e.clientX;
    mousePendingRef.current.startY = e.clientY;
    mousePendingRef.current.target = target;

    window.addEventListener('mousemove', onWindowMouseMovePending as any);
    window.addEventListener('mouseup', onWindowMouseUpPending as any);
  };
const handleEditorClick = (e: React.MouseEvent<HTMLDivElement>) => {
  const target = e.target as HTMLElement | null;
  if (!target) return;

  // delete button inside editor (create/edit)
  const imgDel = target.closest('[data-img-del]') as HTMLElement | null;
  if (imgDel) {
    const wrap = target.closest('[data-img-wrap]') as HTMLElement | null;
    const idx = Number(wrap?.getAttribute('data-img-index') || '-1');
    if (Number.isFinite(idx) && idx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      removeImageByImgIndex(idx);
    }
    return;
  }

  const fileDel = target.closest('[data-file-del]') as HTMLElement | null;
  if (fileDel) {
    const wrap = target.closest('[data-file-index]') as HTMLElement | null;
    const idx = Number(wrap?.getAttribute('data-file-index') || '-1');
    if (Number.isFinite(idx) && idx >= 0) {
      e.preventDefault();
      e.stopPropagation();
      removeFileByDocIndex(idx);
    }
    return;
  }

  // image click inside editor -> open/save sheet
  const img = target.closest('img[data-img-index]') as HTMLElement | null;
  if (img) {
    const idx = Number(img.getAttribute('data-img-index') || '-1');
    if (!Number.isFinite(idx) || idx < 0) return;

    e.preventDefault();
    e.stopPropagation();
    setImageOpenSheet({ imgIndex: idx });
    return;
  }

  // download icon click inside file card
  const dl = target.closest('[data-file-dl]') as HTMLElement | null;
  if (dl) {
    const wrap = target.closest('[data-file-index]') as HTMLElement | null;
    const idx = Number(wrap?.getAttribute('data-file-index') || '-1');
    if (!Number.isFinite(idx) || idx < 0) return;

    e.preventDefault();
    e.stopPropagation();

    setFileOpenSheet({ docIndex: idx });
  }
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
            `<div data-img-wrap="1" data-img-index="${idx}" contenteditable="false" style="position:relative;margin:10px 0;width:100%;box-sizing:border-box;">
            <button type="button" data-img-del="1" aria-label="삭제" style="position:absolute;left:-4px;top:-4px;width:28px;height:28px;border-radius:14px;border:1px solid rgba(255,255,255,0.18);background:rgba(15, 23, 42, 0.55);backdrop-filter:blur(6px);box-shadow:0 6px 18px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;padding:0;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6L6 18"/>
                <path d="M6 6l12 12"/>
              </svg>
            </button>
            <img data-attach-kind="img" data-img-index="${idx}" draggable="true" style="max-width:100%;border-radius:10px;display:block;" />
          </div>`
          );
          html.push('<br/>');
        } else if (kind === 'file') {
          html.push(
            `<div data-attach-kind="file" data-file-index="${idx}" contenteditable="false" style="position:relative;display:flex;align-items:center;gap:10px;padding:12px 14px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;margin:10px 0;box-shadow:0 1px 2px rgba(0,0,0,0.04);width:100%;box-sizing:border-box;">
              <button type="button" data-file-del="1" aria-label="삭제" style="position:absolute;left:-4px;top:-4px;width:28px;height:28px;border-radius:14px;border:1px solid rgba(255,255,255,0.18);background:rgba(15, 23, 42, 0.55);backdrop-filter:blur(6px);box-shadow:0 6px 18px rgba(0,0,0,0.18);display:flex;align-items:center;justify-content:center;cursor:pointer;z-index:10;padding:0;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M18 6L6 18"/>
                  <path d="M6 6l12 12"/>
                </svg>
              </button>
              <div data-file-name="1" style="flex:1;font-weight:700;font-size:14px;color:#111827;word-break:break-all;">파일</div>
              <button type="button" data-file-dl="1" style="width:44px;height:44px;border-radius:14px;border:1px solid #e5e7eb;background:#f8fafc;display:flex;align-items:center;justify-content:center;cursor:pointer;">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0f172a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <path d="M7 10l5 5 5-5"/>
                  <path d="M12 15V3"/>
                </svg>
              </button>
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


  const applyFancyDeleteButtonStyle = (btn: HTMLButtonElement, size = 28) => {
    btn.style.position = 'absolute';
    btn.style.left = '-4px';
    btn.style.top = '-4px';
    btn.style.width = `${size}px`;
    btn.style.height = `${size}px`;
    btn.style.borderRadius = `${Math.floor(size / 2)}px`;
    btn.style.border = '1px solid rgba(255,255,255,0.18)';
    btn.style.background = 'rgba(15, 23, 42, 0.55)'; // slate-900
    (btn.style as any).backdropFilter = 'blur(6px)';
    btn.style.boxShadow = '0 6px 18px rgba(0,0,0,0.18)';
    btn.style.color = '#ffffff';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.padding = '0';
    btn.style.cursor = 'pointer';
    btn.style.zIndex = '10';
    btn.style.userSelect = 'none';
  };

  const setDeleteIcon = (btn: HTMLButtonElement) => {
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M18 6L6 18"/>
        <path d="M6 6l12 12"/>
      </svg>
    `;
  };


const makeBlobFromAttachment = async (att: PostAttachment): Promise<Blob> => {
  const data = att.data || '';
  // data may already be a data: url
  if (data.startsWith('data:')) {
    const res = await fetch(data);
    return await res.blob();
  }
  // otherwise assume raw base64 without prefix
  const b64 = data.includes(',') ? data.split(',').pop() || '' : data;
  const byteStr = atob(b64);
  const bytes = new Uint8Array(byteStr.length);
  for (let i = 0; i < byteStr.length; i++) bytes[i] = byteStr.charCodeAt(i);
  return new Blob([bytes], { type: att.type || 'application/octet-stream' });
};

const openAttachmentInNewTab = async (att: PostAttachment) => {
  try {
    const blob = await makeBlobFromAttachment(att);
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // cleanup later
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    console.error(e);
    alert('파일을 열 수 없습니다.');
  }
};



const openImageInViewer = async (att: PostAttachment) => {
  try {
    const blob = await makeBlobFromAttachment(att);
    const url = URL.createObjectURL(blob);
    setImageViewerUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
  } catch (e) {
    console.error(e);
    alert('이미지를 열 수 없습니다.');
  }
};

const closeImageViewer = () => {
  setImageViewerUrl((prev) => {
    if (prev) URL.revokeObjectURL(prev);
    return null;
  });
};

const downloadAttachmentToDevice = async (att: PostAttachment) => {
  try {
    const blob = await makeBlobFromAttachment(att);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.name || 'download';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (e) {
    console.error(e);
    alert('파일을 저장할 수 없습니다.');
  }
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
        else if (idx > docIndex) n.setAttribute('data-file-index', String(idx - 1));
      }
      syncEditorFilesFromAttachments();
      setContent(serializeEditorToContent());
    });
  };

  const insertFileIntoEditor = (docIndex: number) => {
    const el = editorRef.current;
    if (!el) return;

    const card = document.createElement('div');
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
    card.style.width = '100%';
    card.style.boxSizing = 'border-box';

    // 삭제 버튼 (좌측 상단)
    card.style.position = 'relative';
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', '삭제');
    applyFancyDeleteButtonStyle(delBtn, 28);
    setDeleteIcon(delBtn);
    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeFileByDocIndex(docIndex);
    });
    card.appendChild(delBtn);


    const name = document.createElement('div');
    name.setAttribute('data-file-name', '1');
    name.style.fontWeight = '700';
    name.style.fontSize = '14px';
    name.style.color = '#111827';
    name.style.wordBreak = 'break-all';
    name.textContent = getDocAttachments()[docIndex]?.name || '첨부파일';

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
      for (const n of nodes) {
        const idx = Number(n.getAttribute('data-img-index') || '-1');
        if (idx === imgIndex) {
        const wrap = (n.closest?.('[data-img-wrapper]') as HTMLElement | null);
        (wrap || n).remove();
      }
        else if (idx > imgIndex) n.setAttribute('data-img-index', String(idx - 1));
      }
      syncEditorImagesFromAttachments();
      setContent(serializeEditorToContent());
    });
  };

  const insertImageIntoEditor = (imgIndex: number, dataOverride?: string) => {
    const el = editorRef.current;
    if (!el) return;
    const imgData = dataOverride || getImageAttachments()[imgIndex]?.data;
    if (!imgData) return;

    
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-img-wrapper', '1');
    wrapper.setAttribute('contenteditable', 'false');
    wrapper.style.position = 'relative';
    wrapper.style.width = '100%';
    wrapper.style.margin = '10px 0';
    wrapper.style.boxSizing = 'border-box';

    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.textContent = '×';
    delBtn.setAttribute('aria-label', '삭제');
    applyFancyDeleteButtonStyle(delBtn, 28);
    setDeleteIcon(delBtn);

    delBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      removeImageByImgIndex(imgIndex);
    });

    const img = document.createElement('img');
    img.src = imgData;
    img.setAttribute('data-attach-kind', 'img');
    img.setAttribute('data-img-index', String(imgIndex));
    img.setAttribute('draggable', 'true');
    img.style.maxWidth = '100%';
    img.style.borderRadius = '10px';
    img.style.display = 'block';

    img.addEventListener('dragstart', (e) => {
      (e.dataTransfer as DataTransfer).setData('text/plain', String(imgIndex));
      (e.dataTransfer as DataTransfer).effectAllowed = 'move';
      img.classList.add('opacity-60');
    });
    img.addEventListener('dragend', () => img.classList.remove('opacity-60'));

    // (기존 동작 유지) 데스크톱: 이미지 클릭 시 삭제 확인
    img.addEventListener('click', () => {
      if (isMobile) return;
      if (confirm('이 이미지를 삭제할까요?')) {
        removeImageByImgIndex(imgIndex);
      }
    });

    wrapper.appendChild(img);
    wrapper.appendChild(delBtn);

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
    const target = (e.target as HTMLElement).closest('img[data-img-index]') as HTMLImageElement | null;
    const dragged = el.querySelector(`img[data-img-index="${fromIndex}"]`) as HTMLImageElement | null;
    if (!dragged) return;

    if (target && target !== dragged) {
      target.parentNode?.insertBefore(dragged, target);
      // 줄바꿈이 자연스럽게 유지되도록 br 하나 추가
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

        {type === 'family_events' && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">작성 템플릿</label>
            <div className="flex gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => setTemplate('normal')}
                className={`px-4 py-2 rounded-full border font-bold text-sm transition-all ${
                  template === 'normal' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                일반 글
              </button>
              <button
                type="button"
                onClick={() => setTemplate('obituary')}
                className={`px-4 py-2 rounded-full border font-bold text-sm transition-all ${
                  template === 'obituary' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 hover:bg-gray-50'
                }`}
              >
                부고
              </button>
            </div>
          </div>
        )}


        {/*
          ✅ 첨부 UI
          - 기존: 파일 선택 버튼이 모바일에서만 노출되어 데스크톱에서는 "글 수정" 화면에서 첨부를 추가할 수 없었음
          - 개선: 데스크톱에서도 파일 선택 버튼을 제공 + (데스크톱) 박스 클릭/Enter/Space로 파일 선택 가능
        */}
        <div
          className="bg-gray-50 p-4 rounded-xl border-2 border-dashed border-gray-200"
          onClick={(e) => {
            // 데스크톱: 박스 "빈 공간" 클릭 시에만 파일 선택 열기 (내부 버튼/카드 클릭은 제외)
            if (!isMobile && e.target === e.currentTarget) {
              fileInputRef.current?.click?.();
            }
          }}
          role={!isMobile ? 'button' : undefined}
          tabIndex={!isMobile ? 0 : undefined}
          onKeyDown={(e) => {
            if (!isMobile && (e.key === 'Enter' || e.key === ' ')) {
              fileInputRef.current?.click?.();
            }
          }}
        >
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
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    removeAttachment(idx);
                  }}
                  className="text-red-400 hover:text-red-600"
                >
                  <i className="fas fa-times"></i>
                </button>
              </div>
            ))}
          </div>
        )}

        {isMobile && (
          <div className="mb-3 text-xs text-gray-500">
            첨부: 사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES} · 문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES}
            <span className="ml-2 text-gray-400">(본문에서 길게 눌러 드래그로 순서 변경)</span>
          </div>
        )}

        {!isMobile && (
          <div className="mb-3 text-xs text-gray-500">
            첨부: 사진 {attachments.filter(a => a.type?.startsWith('image/')).length}/{MAX_IMAGE_FILES} · 문서 {attachments.filter(a => !a.type?.startsWith('image/')).length}/{MAX_DOC_FILES}
            <span className="ml-2 text-gray-400">(본문에서 마우스로 드래그하여 순서 변경)</span>
          </div>
        )}

        {/* 모바일/데스크톱 모두 파일 선택 버튼 제공 */}
        <button
          type="button"
          onClick={(e) => {
            // 상위 컨테이너 onClick(데스크톱)과 중복 클릭 방지
            e.stopPropagation();
            fileInputRef.current?.click?.();
          }}
          className="w-full py-3 rounded-xl bg-white border font-bold text-gray-700 flex items-center justify-center gap-2"
        >
          <i className="fas fa-paperclip"></i>
          파일/사진 첨부하기
        </button>
</div>

        {type === 'family_events' && template === 'obituary' ? (
          <div className="mt-2 rounded-3xl border bg-white p-6 sm:p-8">
            <div
              className="rounded-3xl overflow-hidden border shadow-sm"
              style={{
                backgroundImage: "radial-gradient(closest-side, rgba(255,255,255,0.00), rgba(0,0,0,0.05))",
                backgroundSize: 'cover',
                backgroundPosition: 'center',
              }}
            >
              <div className="bg-white/45 backdrop-blur-[1px] p-6 sm:p-10">
                <div className="text-center">
                  <div className="text-sm tracking-[0.35em] text-gray-700 font-bold">謹 弔</div>
                  <h2 className="mt-3 text-2xl sm:text-3xl font-extrabold text-gray-900">부고</h2>
                  <p className="mt-2 text-gray-700">삼가 고인의 명복을 빕니다.</p>
                </div>

                <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">고인 성함</label>
                    <input
                      className="w-full rounded-2xl border p-3 font-bold"
                      value={obituary.deceasedName}
                      onChange={(e) => setObituary((p) => ({ ...p, deceasedName: e.target.value }))}
                      placeholder="예) 홍길동"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">조합원 성함</label>
                    <input
                      className="w-full rounded-2xl border p-3"
                      value={(obituary.memberName || obituary.relation) || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, memberName: e.target.value, relation: e.target.value }))}
                      placeholder="예) 000조합원 부친상, 000조합원 모친상"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">상주/유족</label>
                    <input
                      className="w-full rounded-2xl border p-3"
                      value={obituary.bereaved || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, bereaved: e.target.value }))}
                      placeholder="예) 배우자 ○○○, 장남 ○○○ ..."
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">별세일</label>
                    <WheelDatePicker
                      value={toISODateValue(obituary.deathDate)}
                      onChange={(v) => setObituary((p) => ({ ...p, deathDate: v }))}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">발인</label>
                    <WheelDatePicker
                      value={toISODateValue(obituary.funeralDate)}
                      onChange={(v) => setObituary((p) => ({ ...p, funeralDate: v }))}
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">빈소</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        className="w-full rounded-2xl border p-3"
                        value={obituary.hallName || ''}
                        onChange={(e) => setObituary((p) => ({ ...p, hallName: e.target.value }))}
                        placeholder="장례식장/병원"
                      />
                      <input
                        className="w-full rounded-2xl border p-3"
                        value={obituary.hallRoom || ''}
                        onChange={(e) => setObituary((p) => ({ ...p, hallRoom: e.target.value }))}
                        placeholder="호실(선택)"
                      />
                    </div>
                    <input
                      className="mt-3 w-full rounded-2xl border p-3"
                      value={obituary.hallAddress || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, hallAddress: e.target.value }))}
                      placeholder="주소(선택)"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">장지</label>
                    <input
                      className="w-full rounded-2xl border p-3"
                      value={obituary.burialPlace || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, burialPlace: e.target.value }))}
                      placeholder="예) ○○추모공원"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">연락처</label>
                    <input
                      className="w-full rounded-2xl border p-3"
                      value={obituary.contact || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, contact: e.target.value }))}
                      placeholder="예) 010-0000-0000"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">조의금 계좌</label>
                    <input
                      className="w-full rounded-2xl border p-3"
                      value={obituary.account || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, account: e.target.value }))}
                      placeholder="예) 국민 123-456-789012 (예금주 홍길동)"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-gray-600 mb-1">안내 문구(선택)</label>
                    <textarea
                      className="w-full rounded-2xl border p-3 min-h-[96px]"
                      value={obituary.notice || ''}
                      onChange={(e) => setObituary((p) => ({ ...p, notice: e.target.value }))}
                      placeholder="예) 조문은 ○○까지 / 가족장으로 진행합니다 / 화환은 정중히 사양합니다"
                    />
                  </div>
                </div>

                <div className="mt-6 text-xs text-gray-600">
                  * 저장하면 위 정보로 부고 게시물이 자동 작성됩니다.
                </div>
              </div>
            </div>
          </div>
        ) : (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">내용</label>
          <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={() => setContent(serializeEditorToContent())}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleEditorDrop}
                onClick={handleEditorClick}
                onMouseDown={handleEditorMouseDown}
                onTouchStart={handleEditorTouchStart}
                onTouchEnd={handleEditorTouchEnd}
                onTouchCancel={handleEditorTouchEnd}
                className="w-full min-h-[260px] p-4 border rounded-lg bg-white focus:outline-none"
                style={{ lineHeight: '1.6', whiteSpace: 'pre-wrap' }}
              />
        </div>
        )}


        
        

{fileOpenSheet && (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setFileOpenSheet(null)}>
    <div className="w-[88%] max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="border-t">
        <button
          type="button"
          className="w-full py-5 text-center text-base font-medium active:bg-gray-50"
          onClick={async () => {
            const docs = getDocAttachments();
            const att = docs[fileOpenSheet.docIndex];
            setFileOpenSheet(null);
            if (att) {
              if (isMobile) {
                await openImageInViewer(att);
              } else {
                await openAttachmentInNewTab(att);
              }
            }
          }}
        >
          파일 열기
        </button>
        <div className="h-px bg-gray-200" />
        <button
          type="button"
          className="w-full py-5 text-center text-base font-medium active:bg-gray-50"
          onClick={async () => {
            const docs = getDocAttachments();
            const att = docs[fileOpenSheet.docIndex];
            setFileOpenSheet(null);
            if (att) await downloadAttachmentToDevice(att);
          }}
        >
          {isMobile ? '이 휴대폰에 저장' : '이 PC에 저장'}
        </button>
      </div>
    </div>
  </div>
)}

{imageOpenSheet && (
  <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40" onClick={() => setImageOpenSheet(null)}>
    <div className="w-[88%] max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
      <div className="border-t">
        <button
          type="button"
          className="w-full py-5 text-center text-base font-medium active:bg-gray-50"
          onClick={async () => {
            const imgs = getImageAttachments();
            const att = imgs[imageOpenSheet.imgIndex];
            setImageOpenSheet(null);
            if (att) await openAttachmentInNewTab(att);
          }}
        >
          이미지 열기
        </button>
        <div className="h-px bg-gray-200" />
        <button
          type="button"
          className="w-full py-5 text-center text-base font-medium active:bg-gray-50"
          onClick={async () => {
            const imgs = getImageAttachments();
            const att = imgs[imageOpenSheet.imgIndex];
            setImageOpenSheet(null);
            if (att) await downloadAttachmentToDevice(att);
          }}
        >
          {isMobile ? '이 휴대폰에 저장' : '이 PC에 저장'}
        </button>
      </div>
    </div>
  </div>
)}


{imageViewerUrl && (
  <div className="fixed inset-0 z-[10010] bg-black/90 flex items-center justify-center" onClick={closeImageViewer}>
    <button
      type="button"
      aria-label="닫기"
      className="absolute top-4 right-4 rounded-full bg-white/20 px-3 py-2 text-white text-base"
      onClick={(e) => {
        e.stopPropagation();
        closeImageViewer();
      }}
    >
      ✕
    </button>
    <img
      src={imageViewerUrl}
      alt="preview"
      className="max-h-[90vh] max-w-[94vw] object-contain rounded-lg"
      onClick={(e) => e.stopPropagation()}
    />
  </div>
)}


<div className="flex justify-end space-x-3 pt-4">
          <button onClick={onCancel} className="px-6 py-2 border rounded-lg text-gray-600 hover:bg-gray-50 transition-colors">취소</button>
          <button
            onClick={() => {
            if (type === 'family_events' && template === 'obituary') {
              if (!obituary.deceasedName.trim()) {
                alert('고인 성함을 입력해주세요.');
                return;
              }
              if (!(obituary.memberName || obituary.relation || '').trim()) {
                alert('조합원 성함(예: 000조합원 부친상/모친상)을 입력해주세요.');
                return;
              }
              const memberTitle = ((obituary.memberName || obituary.relation) || '').trim();
              const genTitle = `부고 | ${memberTitle}`.trim();
              const genContent = buildObituaryContent({ ...obituary, kind: 'obituary' });
              onSave(genTitle, genContent, attachments, initialPost?.id);
              return;
            }
            if (!title.trim()) {
              alert('제목을 입력해주세요.');
              return;
            }
            onSave(title, content, attachments, initialPost?.id);
          }}
            disabled={type === 'family_events' && template === 'obituary' ? !obituary.deceasedName : (!title || !content)}
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
