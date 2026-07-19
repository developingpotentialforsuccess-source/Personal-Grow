import React, { useState } from 'react';
import { 
  Bell, 
  Search, 
  Plus, 
  Trash2, 
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  ChevronLeft,
  ChevronRight,
  FilterX,
  LayoutGrid,
  Eye,
  EyeOff,
  Palette,
  CheckSquare,
  GripVertical,
  Archive,
  RotateCcw,
  X,
  AlertTriangle,
  ChevronUp,
  ChevronDown
} from 'lucide-react';
import { Student, FilterState, UserRole } from '../types';
import { format } from 'date-fns';

import { RichTextDiv } from './FloatingToolbar';
import { DictationButton } from './DictationButton';

const MultilineInput: React.FC<{
  value: string;
  onChange: (val: string) => void;
  className?: string;
  style?: React.CSSProperties;
  placeholder?: string;
}> = ({ value, onChange, className, style, placeholder }) => {
  return (
    <div 
      onClick={(e) => {
        const target = e.target as HTMLElement;
        if (target.classList.contains('smart-check-cell')) {
          e.preventDefault();
          const states = ['✅', '❌', '⏳', '⬜'];
          const colors = ['#10b981', '#ef4444', '#f59e0b', '#64748b'];
          const currentText = target.innerText.trim();
          const currentIndex = states.indexOf(currentText);
          const nextIndex = (currentIndex + 1) % states.length;
          target.innerText = states[nextIndex];
          target.style.color = colors[nextIndex];
          
          const editor = target.closest('[contenteditable="true"]') as HTMLElement;
          if (editor) {
            // Trigger onChange by dispatching input event
            const event = new Event('input', { bubbles: true });
            editor.dispatchEvent(event);
          }
        }
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            (e.target as HTMLElement).blur();
        }
    }}>
        <RichTextDiv
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className={className}
        style={{ ...style, resize: 'none', overflow: 'hidden', display: 'block', minHeight: '36px' }}
        />
    </div>
  );
};

interface ReminderTableProps {
  students: Student[];
  onAddStudent: (defaults?: Partial<Student>) => void;
  onUpdateStudent: (id: string, updates: Partial<Student>) => void;
  onDeleteStudent: (id: string) => void;
  onClearCategory: (categories: string[]) => void;
  filters: FilterState;
  setFilters: (filters: FilterState) => void;
  role: UserRole;
  settings?: any;
  onUpdateSettings?: (settings: any) => void;
}

const ReminderTable: React.FC<ReminderTableProps> = ({
  students,
  onAddStudent,
  onUpdateStudent,
  onDeleteStudent,
  onClearCategory,
  filters,
  setFilters,
  role,
  settings,
  onUpdateSettings
}) => {
  const [viewMode, setViewMode] = useState<'Active' | 'Completed'>('Active');
  const [showHistory, setShowHistory] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);
  const [layoutMode, setLayoutMode] = useState<'Table' | 'Board'>('Board');
  const [sortBy, setSortBy] = useState<'Manual' | 'Deadline'>('Manual');

  const parseStoredDate = (str: string): Date | null => {
    if (!str) return null;
    str = str.trim();
    const parsedWord = Date.parse(str);
    if (!isNaN(parsedWord)) return new Date(parsedWord);
    if (str.includes('/')) {
      const parts = str.split('/');
      if (parts.length === 3) {
        const d = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        let y = Number(parts[2]);
        if (y < 100) y += 2000;
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
    }
    if (str.includes('-')) {
      const parts = str.split('-');
      if (parts.length === 3) {
        const y = Number(parts[0]);
        const m = Number(parts[1]) - 1;
        const d = Number(parts[2]);
        const date = new Date(y, m, d);
        if (!isNaN(date.getTime())) return date;
      }
    }
    return null;
  };

  const getUrgencyInfo = (deadlineStr: string) => {
    if (!deadlineStr) return null;
    const parsed = parseStoredDate(deadlineStr);
    if (!parsed) return null;
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const deadline = new Date(parsed);
    deadline.setHours(0, 0, 0, 0);
    
    const diffTime = deadline.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    return {
      days: diffDays,
      isOverdue: diffDays < 0,
      isToday: diffDays === 0,
      isTomorrow: diffDays === 1,
      isSoon: diffDays > 1 && diffDays <= 3
    };
  };

  const filteredReminders = students
    .filter(s => s.category === 'Reminder' && !s.deletedAt)
    .filter(s => {
      const query = (filters.searchQuery || '').toLowerCase();
      return (s.name || '').toLowerCase().includes(query) || 
             (s.note || '').toLowerCase().includes(query) ||
             (s.status || '').toLowerCase().includes(query);
    });

  // Separate reminders into active and archived lists. Sort active by order.
  const activeReminders = filteredReminders
    .filter(s => !s.isArchived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const archivedReminders = filteredReminders
    .filter(s => !!s.isArchived);

  // View state dispatcher
  let baseList = [];
  if (viewMode === 'Completed') {
    baseList = activeReminders.filter(s => s.status === 'Completed');
  } else {
    baseList = activeReminders.filter(s => s.status !== 'Completed');
  }

  const displayedReminders = sortBy === 'Deadline' 
    ? [...baseList].sort((a, b) => {
        const dateA = a.deadline ? parseStoredDate(a.deadline)?.getTime() || Infinity : Infinity;
        const dateB = b.deadline ? parseStoredDate(b.deadline)?.getTime() || Infinity : Infinity;
        return dateA - dateB;
      })
    : baseList;

  const isoToDisplay = (iso: string) => {
      if (!iso) return '';
      const parsed = parseStoredDate(iso);
      if (parsed) {
        return format(parsed, 'MMMM d, yyyy');
      }
      return iso;
  };

  const formatShortDate = (str: string): string => {
      if (!str) return '';
      const parsed = parseStoredDate(str);
      if (parsed) {
        return format(parsed, 'MMM d, yyyy');
      }
      return str;
  };

  const displayToIso = (display: string) => {
      if (!display) return '';
      const parsed = parseStoredDate(display);
      if (parsed) {
        const y = parsed.getFullYear();
        const m = String(parsed.getMonth() + 1).padStart(2, '0');
        const d = String(parsed.getDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return '';
  };

  const updateField = (id: string, field: string, value: any) => {
    let updates: any = { [field]: value };
    
    // Auto-fill deadline if task name is entered and deadline is empty
    if (field === 'name' && value && !students.find(s => s.id === id)?.deadline) {
        updates.deadline = format(new Date(), 'MMMM d, yyyy');
    }
    
    onUpdateStudent(id, updates);
  };

  const handleStatusChange = (s: Student, newStatus: string) => {
    updateField(s.id, 'status', newStatus);
    
    if (newStatus === 'Completed' && s.recurring && s.recurring !== 'None') {
      // Create new duplicated task
      const newDeadlineDate = new Date();
      if (s.recurring === 'Daily') newDeadlineDate.setDate(newDeadlineDate.getDate() + 1);
      if (s.recurring === 'Weekly') newDeadlineDate.setDate(newDeadlineDate.getDate() + 7);
      if (s.recurring === 'Monthly') newDeadlineDate.setMonth(newDeadlineDate.getMonth() + 1);
      
      const newDeadline = format(newDeadlineDate, 'MMMM d, yyyy');
      
      setTimeout(() => {
        onAddStudent({
          category: 'Reminder',
          name: s.name,
          deadline: newDeadline,
          status: 'Pending',
          note: s.note,
          priority: s.priority,
          recurring: s.recurring,
          // Reset subtasks to incomplete
          subtasks: Array.isArray(s.subtasks) ? s.subtasks.map((st: any) => ({ ...st, isCompleted: false })) : []
        });
      }, 0);
    }
  };

  const getRowBg = (idx: number) => {
    const colors = [
      'bg-orange-50/40',
      'bg-rose-50/70',
      'bg-amber-50/40',
      'bg-emerald-50/70',
      'bg-amber-50/70',
      'bg-purple-50/70',
      'bg-orange-50/70',
      'bg-teal-50/70',
      'bg-fuchsia-50/70',
      'bg-lime-50/70'
    ];
    return colors[idx % colors.length];
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'text-emerald-500';
      case 'In Progress': return 'text-emerald-500';
      case 'Urgent': return 'text-orange-500';
      default: return 'text-slate-400';
    }
  };

  const moveReminder = (fromIdx: number, toIdx: number) => {
    const list = [...activeReminders];
    if (toIdx < 0 || toIdx >= list.length) return;
    
    const [moved] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, moved);
    
    list.forEach((item, index) => {
      onUpdateStudent(item.id, { order: index });
    });
  };

  const fontFamilies = [
    { name: 'Modern', value: "Inter, sans-serif" },
    { name: 'Display', value: "Space Grotesk, sans-serif" },
    { name: 'Elegant', value: "Playfair Display, serif" },
    { name: 'Technical', value: "JetBrains Mono, monospace" },
    { name: 'Handwritten', value: "cursive" }
  ];

  return (
    <div className="flex-grow flex flex-col bg-transparent text-stone-800 relative w-full h-full pb-12">
      {/* Header Bar - Title & Subtitle only for elegant presentation */}
      <div className="bg-white/80 backdrop-blur-3xl rounded-[32px] p-6 mb-6 flex flex-col md:flex-row md:items-center justify-between shadow-sm border border-stone-200 gap-4 transition-all max-w-full shrink-0">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-orange-500/30">
            <Bell size={24} strokeWidth={3} />
          </div>
          <div>
            <h1 className="text-xl font-black text-stone-800 uppercase tracking-tight leading-none italic">Growth Reminders</h1>
            <p className="text-[10px] font-bold text-stone-500 uppercase tracking-widest mt-1">Staff Tasks & Notifications</p>
          </div>
        </div>
      </div>

      {/* Control Rows: Exactly Two Lines */}
      <div className="bg-white/80 backdrop-blur-3xl rounded-[32px] p-4 md:p-6 mb-6 border border-stone-200/80 shadow-sm flex flex-col gap-3 md:gap-4">
        {/* Line 1: manual table active and search */}
        <div className="grid grid-cols-4 gap-1.5 md:gap-3 items-center">
          {/* Manual Sort Button */}
          <button 
            onClick={() => setSortBy('Manual')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${sortBy === 'Manual' ? 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <GripVertical size={12} className="shrink-0" /> <span className="hidden sm:inline">Manual</span><span className="sm:hidden">Man</span>
          </button>

          {/* Table Layout Button */}
          <button 
            onClick={() => setLayoutMode('Table')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${layoutMode === 'Table' ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <LayoutGrid size={12} className="shrink-0" /> <span className="hidden sm:inline">Table</span><span className="sm:hidden">Tab</span>
          </button>

          {/* Active Filter Status Button */}
          <button 
            onClick={() => setViewMode('Active')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${viewMode === 'Active' ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <CheckCircle2 size={12} className="shrink-0" /> <span className="hidden sm:inline">Active</span><span className="sm:hidden">Act</span>
          </button>

          {/* Search Input */}
          <div className="relative w-full h-9 md:h-11">
            <Search size={12} className="absolute left-2 md:left-3.5 top-1/2 -translate-y-1/2 text-stone-400 shrink-0" />
            <input 
              type="text" 
              placeholder="Search..." 
              className="w-full h-full pl-6 md:pl-10 pr-2 md:pr-4 bg-stone-50 border border-stone-200 rounded-xl text-[9px] md:text-[11px] font-bold text-stone-750 outline-none focus:bg-white focus:ring-4 focus:ring-orange-500/10 transition-all shadow-inner"
              value={filters.searchQuery}
              onChange={e => setFilters({...filters, searchQuery: e.target.value})}
            />
          </div>
        </div>

        {/* Line 2: detail line, book completed, and new remainder */}
        <div className="grid grid-cols-4 gap-1.5 md:gap-3 items-center">
          {/* Detail Line (Deadline) Sort Button */}
          <button 
            onClick={() => setSortBy('Deadline')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${sortBy === 'Deadline' ? 'bg-orange-500 text-white border-orange-600 shadow-orange-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <Calendar size={12} className="shrink-0" /> <span className="hidden sm:inline">Line</span><span className="sm:hidden">Lin</span>
          </button>

          {/* Board Layout (book is board) Layout Button */}
          <button 
            onClick={() => setLayoutMode('Board')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${layoutMode === 'Board' ? 'bg-indigo-600 text-white border-indigo-700 shadow-indigo-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <Palette size={12} className="shrink-0" /> <span className="hidden sm:inline">Board</span><span className="sm:hidden">Brd</span>
          </button>

          {/* Completed Filter Status Button */}
          <button 
            onClick={() => setViewMode('Completed')}
            className={`h-9 md:h-11 px-1 md:px-4 rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1 md:gap-2 border shadow-xs active:scale-95 whitespace-nowrap overflow-hidden ${viewMode === 'Completed' ? 'bg-emerald-600 text-white border-emerald-700 shadow-emerald-500/20' : 'bg-white border-stone-200 text-stone-500 hover:bg-stone-50'}`}
          >
            <CheckSquare size={12} className="shrink-0" /> <span className="hidden sm:inline">Done</span><span className="sm:hidden">Don</span>
          </button>

          {/* New Reminder Add Button */}
          <button 
            onClick={() => onAddStudent({ category: 'Reminder' })}
            className="h-9 md:h-11 w-full px-1 md:px-4 bg-orange-500 hover:bg-orange-600 text-white rounded-xl text-[8px] md:text-[10px] font-black uppercase tracking-widest shadow-md shadow-orange-500/20 hover:shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1 md:gap-2 shrink-0 border border-orange-600 font-extrabold whitespace-nowrap overflow-hidden"
          >
            <Plus size={14} strokeWidth={3} className="shrink-0" /> <span className="hidden sm:inline">New</span><span className="sm:hidden">New</span>
          </button>
        </div>
      </div>

      {/* Main List Container: Grows dynamically with no inner vertical scrolling block */}
      <div className="bg-white/40 backdrop-blur-3xl rounded-[32px] shadow-sm border border-stone-200/50 flex flex-col mb-6 overflow-hidden flex-1">
        <div className="overflow-x-auto overflow-y-auto mobile-a4-wrapper flex-1" style={{ padding: '0.2in' }}>
          {/* Main View Area */}
          {layoutMode === 'Table' ? (
            <div className="a4-container shadow-none">
              <table className="w-full border-collapse table-auto">
                <thead className="sticky top-0 z-40 bg-white/10 backdrop-blur-xl">
                <tr className="border-b border-white/20">
                  <th className="px-2 h-14 text-[10px] font-black text-slate-900 uppercase tracking-widest w-12">#</th>
                  <th className="text-left px-4 text-[10px] font-black text-slate-900 uppercase tracking-widest pt-5 min-w-[220px]">
                    Task / Item
                  </th>
                  <th className="px-4 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[120px] w-32">Deadline</th>
                  <th className="px-4 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[100px] w-28">Priority</th>
                  <th className="px-4 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[100px] w-28">Recurring</th>
                  <th className="px-4 text-center text-[10px] font-black text-slate-900 uppercase tracking-widest min-w-[120px] w-32">Status</th>
                  <th className="w-16 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest">Del</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 font-sans">
                {displayedReminders
                  .filter(s => filters.showHidden || !s.isHidden)
                  .map((s, idx) => {
                    const urgency = getUrgencyInfo(s.deadline || '');
                    return (
                        <tr 
                        key={s.id} 
                        className={`group hover:bg-white/30 transition-all ${getRowBg(idx)} ${s.isHidden ? 'opacity-50' : ''} ${urgency?.isTomorrow || urgency?.isToday ? 'bg-orange-50/40 ring-1 ring-inset ring-orange-500/20' : ''} ${draggedIdx === idx ? 'opacity-40 border-2 border-dashed border-orange-400 bg-orange-50/10' : ''}`}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          if (draggedIdx !== null && draggedIdx !== idx) {
                            moveReminder(draggedIdx, idx);
                          }
                        }}
                      >
                        <td className="text-center p-2 text-[10px] font-bold text-slate-400 select-none">
                          <div className="flex items-center justify-center gap-1">
                            <div 
                              draggable
                              onDragStart={(e) => {
                                setDraggedIdx(idx);
                              }}
                              onDragEnd={() => {
                                setDraggedIdx(null);
                              }}
                              className="cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 p-1 shrink-0"
                              title="Drag to reorder"
                            >
                              <GripVertical size={14} />
                            </div>
                            <div className="flex flex-col shrink-0">
                              <button 
                                onClick={() => moveReminder(idx, idx - 1)}
                                disabled={idx === 0 || sortBy !== 'Manual'}
                                className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:pointer-events-none p-0.5"
                                title="Move Up"
                              >
                                <ChevronUp size={12} />
                              </button>
                              <button 
                                onClick={() => moveReminder(idx, idx + 1)}
                                disabled={idx === activeReminders.length - 1 || sortBy !== 'Manual'}
                                className="text-slate-300 hover:text-slate-500 disabled:opacity-30 disabled:pointer-events-none p-0.5"
                                title="Move Down"
                              >
                                <ChevronDown size={12} />
                              </button>
                            </div>
                            <span className="ml-1 w-4 text-left">{idx + 1}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 group/cell">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="shrink-0">
                                {s.priority === 'Urgent' ? '🔥' : s.priority === 'High' ? '🔴' : '🟢'}
                              </span>
                              <MultilineInput 
                                value={s.name || ''} 
                                onChange={val => updateField(s.id, 'name', val)}
                                placeholder="Enter task name..."
                                style={{ 
                                  fontFamily: settings?.fontFamily || "Inter, sans-serif",
                                  fontSize: `${Math.max(14, settings?.fontSize || 15)}px`
                                }}
                                className="flex-1 bg-transparent font-black text-slate-900 outline-none placeholder:text-slate-500"
                              />
                            </div>
                            {urgency?.isTomorrow && (
                              <span className="px-2 py-0.5 bg-orange-100 text-orange-600 text-[8px] font-black rounded-full animate-pulse uppercase tracking-widest shrink-0">1 Day Left</span>
                            )}
                            {urgency?.isToday && (
                              <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[8px] font-black rounded-full animate-bounce uppercase tracking-widest shrink-0">Due Today</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4">
                          <div className={`relative flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white/40 rounded-xl border border-slate-100 hover:border-orange-300 transition-all select-none cursor-pointer ${urgency?.isTomorrow || urgency?.isToday ? 'border-orange-400 ring-2 ring-orange-400/20' : ''}`}>
                              <Calendar size={12} className="text-orange-500 shrink-0" />
                              <span className="text-[11px] font-black text-slate-700 capitalize shrink-0">
                                {s.deadline ? formatShortDate(s.deadline) : 'No Date'}
                              </span>
                              <input 
                                type="date"
                                value={displayToIso(s.deadline || '')} 
                                onChange={e => updateField(s.id, 'deadline', isoToDisplay(e.target.value))}
                                className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                              />
                          </div>
                        </td>
                        <td className="px-2 text-center">
                          <div className="flex items-center justify-center">
                            <select
                              value={s.priority || 'High'}
                              onChange={e => updateField(s.id, 'priority', e.target.value)}
                              className={`text-[10px] font-black uppercase tracking-widest outline-none bg-white/50 border border-slate-100 rounded-lg py-1 px-1.5 text-center cursor-pointer transition-colors ${
                                s.priority === 'Urgent' ? 'text-red-600 border-red-200 bg-red-50/20 shadow-sm shadow-red-500/10' :
                                s.priority === 'High' ? 'text-orange-500 border-orange-100 bg-orange-50/10' :
                                'text-emerald-600 border-emerald-100 bg-emerald-50/10'
                              }`}
                            >
                              <option value="Urgent">🔥 URGENT</option>
                              <option value="High">🔴 HIGH</option>
                              <option value="Normal">🟢 NORMAL</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-2 text-center">
                          <div className="flex items-center justify-center">
                            <select
                              value={s.recurring || 'None'}
                              onChange={e => updateField(s.id, 'recurring', e.target.value)}
                              className="text-[10px] font-black uppercase tracking-widest text-orange-500 outline-none bg-white/50 border border-orange-100 rounded-lg py-1 px-1.5 text-center cursor-pointer transition-colors"
                            >
                              <option value="None">↻ ONCE</option>
                              <option value="Daily">↻ DAILY</option>
                              <option value="Weekly">↻ WEEKLY</option>
                              <option value="Monthly">↻ MONTHLY</option>
                            </select>
                          </div>
                        </td>
                        <td className="px-4 text-center">
                          <select 
                            value={s.status || 'Pending'} 
                            onChange={e => handleStatusChange(s, e.target.value)}
                            style={{ 
                              fontFamily: settings?.fontFamily || "Inter, sans-serif",
                              fontSize: `${settings?.fontSize || 10}px`
                            }}
                            className={`bg-transparent font-black outline-none appearance-none cursor-pointer ${getStatusColor(s.status)}`}
                          >
                            <option value="Pending">Pending</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Completed">Completed</option>
                            <option value="Urgent">Urgent</option>
                          </select>
                        </td>
                        <td className="text-center px-4">
                          <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={() => updateField(s.id, 'isHidden', !s.isHidden)}
                              className={`p-1.5 rounded-lg transition-all ${s.isHidden ? 'text-orange-600' : 'text-stone-400 hover:text-orange-600'}`}
                              title={s.isHidden ? "Unhide" : "Hide"}
                            >
                              {s.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                            </button>
                            <button 
                              onClick={() => onDeleteStudent(s.id)}
                              className="p-1.5 text-slate-300 hover:text-orange-500 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
          ) : (
            /* Board View - Column Layout */
            <div className="flex gap-8 min-w-max pb-10 px-4">
              {(['Pending', 'In Progress', 'Completed'] as const).map(statusGroup => {
                const groupReminders = displayedReminders.filter(s => {
                  if (statusGroup === 'Pending') return s.status === 'Pending' || s.status === 'Urgent' || !s.status;
                  return s.status === statusGroup;
                }).filter(s => filters.showHidden || !s.isHidden);

                return (
                  <div key={statusGroup} className="w-[320px] flex flex-col gap-6">
                    <div className="flex items-center justify-between px-4">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-6 rounded-full ${
                          statusGroup === 'Pending' ? 'bg-orange-500' :
                          statusGroup === 'In Progress' ? 'bg-indigo-500' :
                          'bg-emerald-500'
                        }`} />
                        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
                          {statusGroup}
                        </h3>
                        <span className="bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full text-[10px] font-black">
                          {groupReminders.length}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-5 p-2 bg-slate-50/50 rounded-[40px] border border-slate-100 min-h-[500px]">
                      {groupReminders.map((s, idx) => {
                        const urgency = getUrgencyInfo(s.deadline || '');
                        return (
                          <div 
                            key={s.id} 
                            className={`relative p-6 rounded-[32px] border border-white/20 shadow-xl transition-all group hover:scale-[1.02] hover:shadow-2xl ${getRowBg(idx)} ${s.isHidden ? 'opacity-50' : ''} ${urgency?.isTomorrow || urgency?.isToday ? 'ring-4 ring-orange-500/40 shadow-[0_0_40px_-15px_rgba(249,115,22,0.4)] bg-orange-50/30' : ''}`}
                          >
                            {/* Urgency Badge */}
                            {(urgency?.isTomorrow || urgency?.isToday) && (
                              <div className={`absolute -top-4 -right-4 px-5 py-2.5 rounded-2xl shadow-2xl z-10 flex items-center gap-2 animate-bounce border-2 border-white ${urgency.isToday ? 'bg-red-600 text-white' : 'bg-orange-500 text-white'}`}>
                                <AlertTriangle size={18} strokeWidth={3} className="animate-pulse" />
                                <span className="text-[11px] font-black uppercase tracking-[0.1em]">
                                  {urgency.isToday ? 'ATTENTION: DUE NOW' : 'ATTENTION: 24H LEFT'}
                                </span>
                              </div>
                            )}

                            <div className="flex items-start justify-between mb-5">
                              <div className="flex items-center gap-3">
                                <span className="w-10 h-10 bg-white/50 backdrop-blur-md rounded-2xl flex items-center justify-center text-xs font-black text-slate-600 shadow-sm">
                                  {idx + 1}
                                </span>
                                <div className="flex flex-col gap-0.5">
                                  <button 
                                    onClick={() => moveReminder(idx, idx - 1)}
                                    disabled={idx === 0 || sortBy !== 'Manual'}
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                                  >
                                    <ChevronUp size={14} />
                                  </button>
                                  <button 
                                    onClick={() => moveReminder(idx, idx + 1)}
                                    disabled={idx === groupReminders.length - 1 || sortBy !== 'Manual'}
                                    className="text-slate-400 hover:text-indigo-600 disabled:opacity-20"
                                  >
                                    <ChevronDown size={14} />
                                  </button>
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => updateField(s.id, 'isHidden', !s.isHidden)}
                                  className="p-2.5 bg-white/50 backdrop-blur-md rounded-2xl text-slate-400 hover:text-orange-600 shadow-sm transition-all"
                                >
                                  {s.isHidden ? <Eye size={16} /> : <EyeOff size={16} />}
                                </button>
                                <button 
                                  onClick={() => onDeleteStudent(s.id)}
                                  className="p-2.5 bg-rose-50 rounded-2xl text-rose-500 hover:bg-rose-500 hover:text-white shadow-sm transition-all"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </div>

                            <div className="space-y-6">
                              <MultilineInput 
                                value={s.name || ''} 
                                onChange={val => updateField(s.id, 'name', val)}
                                placeholder="What needs doing?"
                                style={{ 
                                  fontFamily: settings?.fontFamily || "Inter, sans-serif",
                                  fontSize: '18px'
                                }}
                                className="w-full bg-transparent font-black text-slate-900 outline-none placeholder:text-slate-400 leading-tight"
                              />

                              <div className="space-y-4">
                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Deadline</label>
                                    <div className={`relative flex items-center gap-3 p-3.5 bg-white/60 backdrop-blur-md rounded-2xl border border-white/40 group-hover:border-orange-300 transition-all ${urgency?.isTomorrow || urgency?.isToday ? 'border-orange-400 bg-orange-50/20' : ''}`}>
                                      <Calendar size={16} className="text-orange-500" />
                                      <span className="text-[11px] font-black text-slate-700">
                                        {s.deadline ? formatShortDate(s.deadline) : 'Not Set'}
                                      </span>
                                      <input 
                                        type="date"
                                        value={displayToIso(s.deadline || '')} 
                                        onChange={e => updateField(s.id, 'deadline', isoToDisplay(e.target.value))}
                                        className="absolute inset-0 opacity-0 cursor-pointer"
                                      />
                                    </div>
                                  </div>
                                  <div className="flex-1 space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Priority</label>
                                    <select
                                      value={s.priority || 'High'}
                                      onChange={e => updateField(s.id, 'priority', e.target.value)}
                                      className={`w-full p-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-white/40 outline-none transition-all ${
                                        s.priority === 'Urgent' ? 'text-red-600 bg-red-50/40 border-red-200 shadow-sm shadow-red-500/10' :
                                        s.priority === 'High' ? 'text-orange-600 bg-orange-50/40 border-orange-200' :
                                        'text-emerald-600 bg-emerald-50/40 border-emerald-200'
                                      }`}
                                    >
                                      <option value="Urgent">🔥 URGENT</option>
                                      <option value="High">🔴 HIGH</option>
                                      <option value="Normal">🟢 NORMAL</option>
                                    </select>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between gap-4">
                                  <div className="flex-1 space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Repeat</label>
                                    <select
                                      value={s.recurring || 'None'}
                                      onChange={e => updateField(s.id, 'recurring', e.target.value)}
                                      className="w-full p-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest text-orange-600 bg-white/60 border border-white/40 outline-none"
                                    >
                                      <option value="None">↻ ONCE</option>
                                      <option value="Daily">↻ DAILY</option>
                                      <option value="Weekly">↻ WEEKLY</option>
                                      <option value="Monthly">↻ MONTHLY</option>
                                    </select>
                                  </div>
                                  <div className="flex-1 space-y-1.5">
                                    <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                                    <select 
                                      value={s.status || 'Pending'} 
                                      onChange={e => handleStatusChange(s, e.target.value)}
                                      className={`w-full p-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest bg-white/80 border border-white/40 outline-none ${getStatusColor(s.status)}`}
                                    >
                                      <option value="Pending">Pending</option>
                                      <option value="In Progress">In Progress</option>
                                      <option value="Completed">Completed</option>
                                      <option value="Urgent">Urgent</option>
                                    </select>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {displayedReminders.length === 0 && (
            <div className="py-20 text-center">
              <div className="flex flex-col items-center gap-3 opacity-20">
                <Bell size={48} />
                <p className="text-xs font-black uppercase tracking-widest">No reminders set</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Collapsible Archived Reminders History Section */}
      <div className="mt-6 bg-white/[0.01] backdrop-blur-3xl rounded-[32px] border border-white/10 overflow-hidden shadow-xl shrink-0">
        <button 
          onClick={() => setShowHistory(!showHistory)}
          className="w-full px-6 py-4 flex items-center justify-between text-slate-850 hover:bg-white/5 transition-all outline-none"
        >
          <div className="flex items-center gap-2">
            <Archive size={16} className="text-amber-500" />
            <span className="text-[11px] font-black uppercase tracking-widest text-slate-900 select-none">
              Archived History Section ({archivedReminders.length})
            </span>
          </div>
          <span className="text-xs text-slate-400 font-bold select-none">
            {showHistory ? 'Collapse' : 'Expand'}
          </span>
        </button>

        {showHistory && (
          <div className="px-6 pb-6 border-t border-white/10 pt-4 overflow-x-auto max-h-[300px] custom-scrollbar">
            {archivedReminders.length === 0 ? (
              <div className="text-center py-8 text-xs text-slate-450 font-bold uppercase tracking-widest select-none">
                No archived reminders in history
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex justify-end mb-2">
                  <button 
                    onClick={() => {
                      if (window.confirm('Are you sure you want to permanently delete all archived history?')) {
                        archivedReminders.forEach(r => onDeleteStudent(r.id));
                      }
                    }}
                    className="px-3 py-1.5 bg-red-500/10 hover:bg-red-500 hover:text-white text-red-500 transition-all rounded-lg text-[9px] font-black uppercase tracking-widest"
                  >
                    Clear History Permanently
                  </button>
                </div>
                <table className="w-full text-left border-collapse table-auto min-w-[700px]">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400">
                      <th className="w-12 pb-2 text-[9px] font-black uppercase tracking-wider">#</th>
                      <th className="pb-2 text-[9px] font-black uppercase tracking-wider">Task Name</th>
                      <th className="w-32 pb-2 text-[9px] font-black uppercase tracking-wider text-center">Deadline</th>
                      <th className="w-32 pb-2 text-[9px] font-black uppercase tracking-wider text-center">Status</th>
                      <th className="w-32 pb-2 text-[9px] font-black uppercase tracking-wider text-center flex justify-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-700">
                    {archivedReminders.map((r, i) => (
                      <tr key={r.id} className="hover:bg-white/5 h-10 transition-colors">
                        <td className="text-[10px] font-bold text-slate-400">{i + 1}</td>
                        <td className="truncate text-xs font-bold text-slate-800 pr-4">
                          {r.name ? r.name.replace(/<[^>]*>/g, '') : 'Unnamed task'}
                        </td>
                        <td className="text-center text-[10px] font-medium text-slate-500">{r.deadline || 'No Deadline'}</td>
                        <td className="text-center text-[10px] font-black text-emerald-500">{r.status || 'Completed'}</td>
                        <td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              onClick={() => onUpdateStudent(r.id, { isArchived: false })}
                              className="p-1 text-slate-400 hover:text-indigo-600 transition-colors"
                              title="Restore to active list"
                            >
                              <RotateCcw size={14} />
                            </button>
                            <button
                              onClick={() => onDeleteStudent(r.id)}
                              className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                              title="Delete permanently"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Mobile Floating Action Button (FAB) to instantly add new reminders */}
      <button 
        onClick={() => onAddStudent({ category: 'Reminder' })}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-orange-500 hover:bg-orange-600 active:scale-95 text-white rounded-full flex items-center justify-center shadow-2xl shadow-orange-500/40 border border-white/20 transition-all cursor-pointer"
        title="Quick Add Reminder"
        id="quick-add-reminder-fab"
      >
        <Plus size={24} strokeWidth={3} />
      </button>
    </div>
  );
};

export default ReminderTable;
