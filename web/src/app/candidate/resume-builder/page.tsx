// src/app/candidate/resume-builder/page.tsx
'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { FileText, Download, Eye, Sparkles, User, Briefcase, GraduationCap, Award, Upload, X, Mic, BookOpen, FolderGit2, Palette, StopCircle, UploadCloud, Copy, Trash2, Bold, Italic, List, ListOrdered, Link as LinkIcon, Unlink, FilePlus2, LayoutTemplate, Save, CheckCircle2, Star, FolderOpen, ChevronDown, ChevronUp, Loader2, Globe, Heart, Trophy, Target, ChevronUp as ArrowUp, ChevronDown as ArrowDown, EyeOff, Languages, Mail, AlignLeft, GripVertical } from 'lucide-react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import LinkExtension from '@tiptap/extension-link';
import Placeholder from '@tiptap/extension-placeholder';

import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { auth, db, storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { decryptApiKey } from '@/lib/crypto';


// --- Type Definitions ---
export interface PersonalInfo { name: string; email: string; phone: string; location: string; legalStatus: string; website?: string; linkedin?: string; }
export interface ExperienceEntry { id: string; jobTitle: string; company: string; dates: string; description: string; }
export interface EducationEntry { id: string; degree: string; institution: string; graduationYear: string; gpa: string; achievements: string; }
export interface SkillCategory { id: string; category: string; skills_list: string; }
export interface CertificationEntry { id: string; name: string; issuer: string; date: string; }
export interface PublicationEntry { id: string; title: string; authors: string; journal: string; date: string; link: string; }
export interface ProjectEntry { id: string; title: string; date: string; description: string; }
export interface LanguageEntry { id: string; language: string; proficiency: string; }
export interface VolunteerEntry { id: string; role: string; organization: string; dates: string; description: string; }
export interface AwardEntry { id: string; title: string; organization: string; date: string; description: string; }
export interface ResumeData { personal: PersonalInfo; summary: string; experience: ExperienceEntry[]; education: EducationEntry[]; skills: SkillCategory[]; certifications: CertificationEntry[]; publications: PublicationEntry[]; projects: ProjectEntry[]; languages: LanguageEntry[]; volunteer: VolunteerEntry[]; awards: AwardEntry[]; }
type EnhancementContext = | { section: 'summary' } | { section: 'experience'; index: number } | { section: 'education'; index: number } | { section: 'projects'; index: number } | { section: 'volunteer'; index: number };
export interface StyleOptions { fontFamily: string; fontSize: number; accentColor: string; lineSpacing: number; pageMargin: 'narrow' | 'normal' | 'wide'; }
export type ResumeTemplate = 'classic' | 'modern' | 'minimal' | 'executive' | 'creative' | 'compact';

const DEFAULT_SECTION_ORDER = ['summary','experience','education','skills','projects','certifications','publications','languages','volunteer','awards'];

// --- useHistory Hook (Simplified - removed undo/redo functionality) ---
const useHistory = (initialState: any) => {
    const [history, setHistory] = useState([initialState]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const setState = (action: any, overwrite = false) => {
        const newState = typeof action === 'function' ? action(history[currentIndex]) : action;
        if (!overwrite && JSON.stringify(newState) === JSON.stringify(history[currentIndex])) return;
        const newHistory = history.slice(0, currentIndex + 1);
        setHistory([...newHistory, newState]);
        setCurrentIndex(newHistory.length);
    };

    // Undo/Redo functionality removed from here
    return { state: history[currentIndex], setState, undo: () => {}, redo: () => {}, canUndo: false, canRedo: false };
};

// --- UI Primitive Components ---
const Card = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="glass" {...props}>{children}</div>);
const CardHeader = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6" {...props}>{children}</div>);
const CardTitle = ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => (<h3 className="text-xl font-semibold text-white" {...props}>{children}</h3>);
const CardContent = ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (<div className="p-6 pt-0" {...props}>{children}</div>);
const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default' | 'outline' | 'destructive', size?: 'default' | 'sm', as?: React.ElementType }>(({ children, variant, size, className, as: Component = 'button', ...props }, ref) => {
    const baseStyle = "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50 disabled:pointer-events-none";
    const variantStyles = { default: "bg-indigo-600 text-white hover:bg-indigo-700", outline: "border border-gray-300 text-white bg-transparent hover:bg-white/10 hover:border-white/20", destructive: "bg-red-600 text-white hover:bg-red-700" };
    const sizeStyles = { default: "h-10 py-2 px-4", sm: "h-9 px-3" };
    return <Component ref={ref} className={`${baseStyle} ${variantStyles[variant || 'default']} ${sizeStyles[size || 'default']} ${className}`} {...props}>{children}</Component>;
});
Button.displayName = 'Button';

const Input = (props: React.InputHTMLAttributes<HTMLInputElement>) => (<input {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />);
const Select = ({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) => (<select {...props} className="flex h-10 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white">{children}</select>);
const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => (<label {...props} className="text-sm font-medium leading-none block mb-1 text-gray-200" />);
const Textarea = (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => ( <textarea {...props} className="flex min-h-[80px] w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400" />);

// --- Utility function to unescape HTML entities ---
function unescapeHtml(html: string) {
    if (typeof document === 'undefined' || !html) {
        return html;
    }
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.documentElement.textContent || html;
}

// --- Convert any resume text value to valid Tiptap HTML ---
// Handles: already-valid HTML, entity-encoded HTML from some AI providers, plain text
function toEditorHtml(value: string): string {
    const empty = '<p></p>';
    if (!value) return empty;
    const v = value.trim();
    if (!v) return empty;
    // Already proper HTML (starts with a tag)
    if (v.startsWith('<') && v.includes('>')) return v;
    // Entity-encoded HTML (e.g. &lt;ul&gt; from some AI responses)
    if (typeof document !== 'undefined' && (v.includes('&lt;') || v.includes('&gt;'))) {
        const d = new DOMParser().parseFromString(v, 'text/html');
        const decoded = d.body?.innerHTML ?? v;
        if (decoded.trim().startsWith('<')) return decoded.trim();
        return decoded.trim() ? `<p>${decoded.trim()}</p>` : empty;
    }
    // Plain text — wrap in paragraph so Tiptap renders it correctly
    return `<p>${v.replace(/\n{2,}/g, '</p><p>').replace(/\n/g, '<br>')}</p>`;
}

// --- Tiptap Editor Wrapper Component ---
const TiptapEditor = ({ value, onChange, placeholder }: { value: string; onChange: (html: string) => void; placeholder?: string }) => {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    const editor = useEditor({
        extensions: [
            StarterKit.configure({
                blockquote: false,
                code: false,
                horizontalRule: false,
                hardBreak: false,
                gapcursor: false,
                history: false,
            } as any),
            LinkExtension.configure({
                openOnClick: false,
                autolink: true,
                linkOnPaste: true,
            }),
            Placeholder.configure({
                placeholder: placeholder || 'Write something...',
            }),
        ],
        content: value || '<p></p>',
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
        editorProps: {
            attributes: {
                class: 'prose prose-sm max-w-none text-white focus:outline-none min-h-[150px] p-3 rounded-md border border-white/20 bg-white/10',
            },
        },
        injectCSS: false,
        immediatelyRender: false,
    }, [value]);

    if (!mounted || !editor) {
        return (
            <div className="min-h-[150px] p-3 rounded-md border border-white/20 bg-white/10 text-white placeholder-gray-400">
                {placeholder || 'Loading editor...'}
            </div>
        );
    }

    return (
        <div className="tiptap-editor-wrapper">
            <div className="flex items-center gap-1 p-2 rounded-t-md border border-white/20 bg-white/10 text-white">
                <button
                    onClick={() => editor.chain().focus().toggleBold().run()}
                    className={editor.isActive('bold') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <Bold size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleItalic().run()}
                    className={editor.isActive('italic') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <Italic size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleBulletList().run()}
                    className={editor.isActive('bulletList') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <List size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().toggleOrderedList().run()}
                    className={editor.isActive('orderedList') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <ListOrdered size={16} />
                </button>
                <button
                    onClick={() => {
                        const previousUrl = editor.getAttributes('link').href;
                        const url = window.prompt('URL', previousUrl);

                        if (url === null) {
                            return;
                        }

                        if (url === '') {
                            editor.chain().focus().extendMarkRange('link').unsetLink().run();
                            return;
                        }

                        editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
                    }}
                    className={editor.isActive('link') ? 'is-active p-1 rounded bg-white/20' : 'p-1 rounded hover:bg-white/10'}
                    type="button"
                >
                    <LinkIcon size={16} />
                </button>
                <button
                    onClick={() => editor.chain().focus().unsetLink().run()}
                    disabled={!editor.isActive('link')}
                    className="p-1 rounded hover:bg-white/10"
                    type="button"
                >
                    <Unlink size={16} />
                </button>
            </div>
            <EditorContent editor={editor} />
        </div>
    );
};


// --- Refactored Form Section Components ---
const PersonalForm = ({ data, onChange, onPicChange, onPicRemove, picPreview }: any) => (
    <div className="space-y-4">
        <div className="grid md:grid-cols-2 gap-4">
            <div><Label>Full Name</Label><Input value={data.name || ''} onChange={e => onChange('name', e.target.value)} /></div>
            <div><Label>Email</Label><Input type="email" value={data.email || ''} onChange={e => onChange('email', e.target.value)} /></div>
            <div><Label>Phone</Label><Input value={data.phone || ''} onChange={e => onChange('phone', e.target.value)} /></div>
            <div><Label>Location</Label><Input value={data.location || ''} onChange={e => onChange('location', e.target.value)} /></div>
            <div><Label>LinkedIn URL (optional)</Label><Input value={data.linkedin || ''} placeholder="linkedin.com/in/username" onChange={e => onChange('linkedin', e.target.value)} /></div>
            <div><Label>Website / Portfolio (optional)</Label><Input value={data.website || ''} placeholder="yoursite.com" onChange={e => onChange('website', e.target.value)} /></div>
        </div>
        <div><Label>Legal Status</Label><Select value={data.legalStatus || 'Prefer not to say'} onChange={e => onChange('legalStatus', e.target.value)}><option>Prefer not to say</option><option>U.S. Citizen</option><option>Permanent Resident</option><option>Work Visa (H-1B)</option><option>OPT / CPT</option><option>EU Citizen</option></Select></div>
        <div>
            <Label>Profile Picture</Label>
            <div className="flex items-center gap-4">
                <Input type="file" accept="image/png, image/jpeg" onChange={onPicChange} className="flex-1"/>
                {picPreview && (
                    <div className="relative">
                        <img src={picPreview} alt="Preview" className="w-16 h-16 rounded-full object-cover border-2 border-gray-200"/>
                        <Button variant="destructive" size="sm" className="absolute -top-1 -right-1 rounded-full p-1 h-auto" onClick={onPicRemove}><X size={12}/></Button>
                    </div>
                )}
            </div>
        </div>
    </div>
);

const SummaryForm = ({ value, onChange, onEnhance, loading, suggestions, newBatchFrom, onApplySuggestion, onDismissSuggestions, onGenerateMore, suggestionsLoading }: any) => {
    const hasSuggestions = suggestions && suggestions.length > 0;
    return (
        <div className="space-y-4">
            {/* ── AI Suggestion Panel ── */}
            {hasSuggestions && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-500/20">
                        <div className="flex items-center gap-2">
                            <Sparkles size={14} className="text-indigo-400" />
                            <span className="text-sm font-semibold text-indigo-300">
                                AI-generated summaries
                            </span>
                            <span className="text-[10px] font-medium bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full">
                                {suggestions.length}
                            </span>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onGenerateMore}
                                disabled={suggestionsLoading}
                                className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-400 hover:text-indigo-200 disabled:opacity-50 transition-colors border border-indigo-500/30 hover:border-indigo-400/50 rounded-md px-2 py-1"
                            >
                                {suggestionsLoading
                                    ? <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />Generating…</>
                                    : <><Sparkles size={11} />Generate more</>
                                }
                            </button>
                            <button type="button" onClick={onDismissSuggestions} className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"><X size={13} /></button>
                        </div>
                    </div>

                    {/* Suggestion list */}
                    <div className="p-3 space-y-2 max-h-80 overflow-y-auto">
                        {suggestions.map((s: string, i: number) => {
                            const isNew = newBatchFrom > 0 && i === newBatchFrom;
                            return (
                                <React.Fragment key={i}>
                                    {isNew && (
                                        <div className="flex items-center gap-2 py-1">
                                            <div className="flex-1 h-px bg-indigo-500/20" />
                                            <span className="text-[9px] font-bold uppercase tracking-widest text-indigo-500">New batch</span>
                                            <div className="flex-1 h-px bg-indigo-500/20" />
                                        </div>
                                    )}
                                    <div
                                        className="group flex items-start gap-3 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 hover:border-indigo-500/40 p-3 transition-all cursor-pointer"
                                        onClick={() => onApplySuggestion(s)}
                                    >
                                        <span className={`flex-shrink-0 mt-0.5 w-5 h-5 rounded-full border text-[10px] font-bold flex items-center justify-center ${i >= newBatchFrom && newBatchFrom > 0 ? 'bg-indigo-500/30 border-indigo-400/60 text-indigo-200' : 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'}`}>
                                            {i + 1}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs text-zinc-300 leading-relaxed line-clamp-3" dangerouslySetInnerHTML={{ __html: s }} />
                                        </div>
                                        <span className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-indigo-400 font-semibold mt-0.5 whitespace-nowrap">Use →</span>
                                    </div>
                                </React.Fragment>
                            );
                        })}
                    </div>

                    {/* Footer hint */}
                    <div className="px-4 py-2 border-t border-indigo-500/20 bg-indigo-500/5">
                        <p className="text-[10px] text-zinc-500">Click any option to apply it to the editor. You can then edit or enhance it further.</p>
                    </div>
                </div>
            )}

            {/* ── Editor ── */}
            <div>
                <div className="flex items-center justify-between mb-1">
                    <Label>Professional Summary</Label>
                    {!hasSuggestions && (
                        <button
                            type="button"
                            onClick={onGenerateMore}
                            disabled={suggestionsLoading}
                            className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-200 disabled:opacity-50 transition-colors"
                        >
                            {suggestionsLoading
                                ? <><span className="w-3 h-3 border border-indigo-400 border-t-transparent rounded-full animate-spin inline-block" />Generating…</>
                                : <><Sparkles size={11} />Generate with AI</>
                            }
                        </button>
                    )}
                </div>
                <TiptapEditor
                    value={value || ''}
                    onChange={onChange}
                    placeholder="A concise summary of your professional experience and goals..."
                />
                <Button size="sm" variant="outline" className="mt-2" onClick={onEnhance} disabled={loading}><Sparkles size={14} className="mr-1.5" />Enhance</Button>
            </div>
        </div>
    );
};

// ─── Skill suggestions pool ───────────────────────────────────────────────
const ALL_SKILL_SUGGESTIONS = [
  // Languages
  'Python','JavaScript','TypeScript','Java','C++','C#','Go','Rust','Swift','Kotlin','PHP','Ruby','Scala','R','MATLAB','Bash','SQL','HTML','CSS',
  // Frontend
  'React','Next.js','Vue.js','Angular','Svelte','Redux','Tailwind CSS','SASS/SCSS','Framer Motion','Three.js','Webpack','Vite',
  // Backend
  'Node.js','Express','Flask','FastAPI','Django','Spring Boot','NestJS','GraphQL','REST APIs','gRPC','WebSockets',
  // Data / ML
  'TensorFlow','PyTorch','scikit-learn','Pandas','NumPy','Keras','Hugging Face','LangChain','OpenCV','Spark','Hadoop',
  // Cloud / DevOps
  'AWS','Azure','GCP','Docker','Kubernetes','Terraform','CI/CD','Jenkins','GitHub Actions','Linux','Nginx',
  // Databases
  'PostgreSQL','MySQL','MongoDB','Redis','Firestore','DynamoDB','Elasticsearch','Supabase','SQLite','Cassandra',
  // Tools
  'Git','Figma','Postman','Jira','Notion','VS Code','Xcode','Android Studio',
  // Other
  'Machine Learning','Deep Learning','NLP','Computer Vision','Microservices','Agile','Scrum','System Design','Data Structures','Algorithms',
];

// ─── SkillTagInput ─────────────────────────────────────────────────────────
const SkillTagInput = ({ value, onChange }: { value: string; onChange: (v: string) => void }) => {
    const [input, setInput] = useState('');
    const [focused, setFocused] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    // Convert comma-string ↔ array
    const tags: string[] = value
        ? value.split(',').map(s => s.trim()).filter(Boolean)
        : [];

    const updateTags = (next: string[]) => onChange(next.join(', '));

    const addTag = (tag: string) => {
        const clean = tag.trim();
        if (!clean || tags.includes(clean)) { setInput(''); return; }
        updateTags([...tags, clean]);
        setInput('');
    };

    const removeTag = (tag: string) => updateTags(tags.filter(t => t !== tag));

    const suggestions = input.trim().length > 0
        ? ALL_SKILL_SUGGESTIONS.filter(
            s => s.toLowerCase().includes(input.toLowerCase()) && !tags.includes(s)
          ).slice(0, 8)
        : [];

    const handleKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(input); }
        if (e.key === 'Backspace' && !input && tags.length) removeTag(tags[tags.length - 1]);
    };

    return (
        <div className="relative">
            {/* Tag container */}
            <div
                className="min-h-[52px] flex flex-wrap gap-1.5 items-center p-2.5 rounded-lg border border-white/20 bg-white/5 cursor-text focus-within:border-indigo-500/60 transition-colors"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map(tag => (
                    <span
                        key={tag}
                        className="inline-flex items-center gap-1 bg-indigo-500/20 border border-indigo-500/40 text-indigo-200 text-xs font-medium px-2.5 py-1 rounded-full"
                    >
                        {tag}
                        <button
                            type="button"
                            onClick={e => { e.stopPropagation(); removeTag(tag); }}
                            className="hover:text-rose-400 transition-colors ml-0.5"
                        >
                            <X size={10} strokeWidth={3} />
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setTimeout(() => setFocused(false), 150)}
                    placeholder={tags.length === 0 ? 'Type a skill and press Enter or comma…' : 'Add more…'}
                    className="flex-1 min-w-[120px] bg-transparent text-sm text-white placeholder-zinc-500 focus:outline-none"
                />
            </div>

            {/* Suggestions dropdown */}
            {focused && suggestions.length > 0 && (
                <div className="absolute z-50 top-full mt-1.5 left-0 right-0 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 px-3 pt-2 pb-1">Suggestions</p>
                    <div className="flex flex-wrap gap-1.5 p-2.5">
                        {suggestions.map(s => (
                            <button
                                key={s}
                                type="button"
                                onMouseDown={() => addTag(s)}
                                className="text-xs bg-white/5 hover:bg-indigo-500/30 border border-white/10 hover:border-indigo-500/50 text-zinc-300 hover:text-white px-2.5 py-1 rounded-full transition-all"
                            >
                                {s}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── DynamicSection ────────────────────────────────────────────────────────
const DynamicSection = ({ sectionKey, data, onChange, onAdd, onRemove, onEnhance, fields, addPayload, loading }: any) => (
    <div className="space-y-4">
        {(data || []).map((item: any, index: number) => ( // Ensure data is an array
            <div key={item.id} className="p-4 border border-white/20 rounded-lg relative space-y-3">
                 <Button variant="destructive" size="sm" className="absolute top-2 right-2" onClick={() => onRemove(sectionKey, item.id)}><Trash2 size={14} /></Button>
                 <div className="grid md:grid-cols-2 gap-4">
                    {fields.map((field: any) => {
                        const colSpanClass = field.colSpan === 2 ? 'md:col-span-2' : '';
                        
                        let InputComponent;
                        let inputProps: any = {
                            value: item[field.key] || '',
                            onChange: (e: any) => onChange(sectionKey, index, field.key, e.target.value),
                            placeholder: `Enter ${field.label.toLowerCase()}...`
                        };

                        if (field.type === 'textarea' || field.type === 'quill') {
                            InputComponent = TiptapEditor;
                            inputProps.onChange = (val: string) => onChange(sectionKey, index, field.key, val);
                            inputProps.value = item[field.key] || '';
                        } else if (field.type === 'plain_textarea') {
                            InputComponent = Textarea;
                            inputProps.onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(sectionKey, index, field.key, e.target.value);
                            inputProps.rows = 5;
                            inputProps.placeholder = `Enter ${field.label.toLowerCase()}...`;
                        } else if (field.type === 'skill_tags') {
                            return (
                                <div key={field.key} className={colSpanClass}>
                                    <Label>{field.label}</Label>
                                    <SkillTagInput
                                        value={item[field.key] || ''}
                                        onChange={(v) => onChange(sectionKey, index, field.key, v)}
                                    />
                                </div>
                            );
                        }
                        else {
                            InputComponent = Input;
                        }

                        return (
                            <div key={field.key} className={colSpanClass}>
                                <Label>{field.label}</Label>
                                <InputComponent {...inputProps} />
                                {field.enhance && (
                                    <Button size="sm" variant="outline" className="mt-2" onClick={() => onEnhance({ section: sectionKey, index })} disabled={loading}><Sparkles size={14} className="mr-1.5" />Enhance</Button>
                                )}
                            </div>
                        );
                    })}
                 </div>
            </div>
        ))}
        <Button variant="outline" onClick={() => onAdd(sectionKey, addPayload)}>+ Add {sectionKey.charAt(0).toUpperCase() + sectionKey.slice(1)}</Button>
    </div>
);


// ─── Languages Form ────────────────────────────────────────────────────────
const PROFICIENCY_LEVELS = ['Native', 'Fluent', 'Advanced', 'Conversational', 'Basic'];

const LanguagesForm = ({ data, onChange, onAdd, onRemove }: any) => (
    <div className="space-y-3">
        {(data || []).map((item: LanguageEntry, index: number) => (
            <div key={item.id} className="flex items-center gap-3 p-3 border border-white/20 rounded-lg">
                <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                        <Label>Language</Label>
                        <Input value={item.language || ''} placeholder="e.g. Spanish" onChange={e => onChange('languages', index, 'language', e.target.value)} />
                    </div>
                    <div>
                        <Label>Proficiency</Label>
                        <Select value={item.proficiency || 'Conversational'} onChange={e => onChange('languages', index, 'proficiency', e.target.value)}>
                            {PROFICIENCY_LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                        </Select>
                    </div>
                </div>
                <Button variant="destructive" size="sm" className="mt-5" onClick={() => onRemove('languages', item.id)}><X size={14} /></Button>
            </div>
        ))}
        <Button variant="outline" onClick={() => onAdd('languages', { language: '', proficiency: 'Conversational' })}>+ Add Language</Button>
    </div>
);

// ─── JD Match Panel ────────────────────────────────────────────────────────
const JDMatchPanel = ({ resumeData, apiBase, getToken }: { resumeData: ResumeData; apiBase: string; getToken: () => Promise<string | null>; }) => {
    const [jdText, setJdText] = useState('');
    const [jobTitle, setJobTitle] = useState('');
    const [company, setCompany] = useState('');
    const [result, setResult] = useState<{ score: number; matchingSkills: string[]; missingKeywords: string[]; optimizationTips: string[] } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [tailoring, setTailoring] = useState(false);
    const [tailored, setTailored] = useState(false);
    const { toast } = { toast: (v: any) => {} }; // toast is called via sonner below

    const analyze = async () => {
        if (!jdText.trim()) { import('sonner').then(m => m.toast.warning('Paste a job description first')); return; }
        setAnalyzing(true);
        setResult(null);
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/grade-resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ resumeData, jobDetails: { title: jobTitle, description: jdText, company } }),
            });
            if (res.status === 402) { import('sonner').then(m => m.toast.warning('Add API keys in Settings to use JD analysis')); return; }
            const data = await res.json();
            setResult(data);
        } catch { import('sonner').then(m => m.toast.error('Analysis failed. Try again.')); }
        finally { setAnalyzing(false); }
    };

    const autoTailor = async () => {
        if (!result) return;
        setTailoring(true);
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/resume/tailor-to-jd`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ resumeData, jobDescription: jdText, missingKeywords: result.missingKeywords }),
            });
            if (res.ok) {
                setTailored(true);
                import('sonner').then(m => m.toast.success('Resume auto-tailored! Re-run analysis to check new score.'));
            } else { import('sonner').then(m => m.toast.error('Tailoring failed. Try again.')); }
        } catch { import('sonner').then(m => m.toast.error('Tailoring failed.')); }
        finally { setTailoring(false); }
    };

    const scoreColor = result ? (result.score >= 80 ? '#34d399' : result.score >= 55 ? '#818cf8' : '#f87171') : '#818cf8';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div><Label>Job Title</Label><Input placeholder="e.g. Senior Engineer" value={jobTitle} onChange={e => setJobTitle(e.target.value)} /></div>
                <div><Label>Company</Label><Input placeholder="e.g. Stripe" value={company} onChange={e => setCompany(e.target.value)} /></div>
            </div>
            <div>
                <Label>Paste Job Description</Label>
                <textarea
                    value={jdText}
                    onChange={e => setJdText(e.target.value)}
                    rows={8}
                    placeholder="Paste the full job description here…"
                    className="flex min-h-[160px] w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder-gray-400"
                />
            </div>
            <Button onClick={analyze} disabled={analyzing} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
                {analyzing ? <><Loader2 size={14} className="mr-2 animate-spin" />Analyzing…</> : <><Target size={14} className="mr-2" />Analyze Match</>}
            </Button>

            {result && (
                <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2">
                    {/* Score circle */}
                    <div className="flex items-center gap-5 p-4 rounded-2xl bg-white/[0.04] border border-white/[0.08]">
                        <div className="relative w-20 h-20 shrink-0">
                            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" strokeWidth="7" fill="transparent" className="stroke-slate-700/80" />
                                <circle cx="40" cy="40" r="34" strokeWidth="7" fill="transparent" strokeDasharray={2 * Math.PI * 34}
                                    strokeDashoffset={2 * Math.PI * 34 * (1 - result.score / 100)}
                                    strokeLinecap="round" style={{ stroke: scoreColor, transition: 'stroke-dashoffset 1s ease' }} />
                            </svg>
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                                <span className="text-2xl font-black text-white leading-none">{result.score}</span>
                                <span className="text-[9px] text-zinc-400">/ 100</span>
                            </div>
                        </div>
                        <div className="flex-1">
                            <p className="text-white font-bold text-base">
                                {result.score >= 80 ? 'Great match!' : result.score >= 55 ? 'Decent match' : 'Needs work'}
                            </p>
                            <p className="text-zinc-400 text-xs mt-1">
                                {result.score >= 80 ? 'Your resume aligns well with this role.' : `Add ${100 - result.score} pts to reach 100 — tailor below.`}
                            </p>
                            {result.missingKeywords.length > 0 && (
                                <Button onClick={autoTailor} disabled={tailoring || tailored} size="sm"
                                    className="mt-3 bg-violet-600 hover:bg-violet-700 text-white text-xs">
                                    {tailoring ? <><Loader2 size={12} className="mr-1.5 animate-spin" />Tailoring…</>
                                        : tailored ? <><CheckCircle2 size={12} className="mr-1.5" />Tailored!</>
                                        : <><Sparkles size={12} className="mr-1.5" />Auto-tailor with AI</>}
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Keywords present */}
                    {result.matchingSkills.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-2">Keywords matched ({result.matchingSkills.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                                {result.matchingSkills.map((k, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-emerald-500/15 border border-emerald-500/30 text-emerald-300">
                                        <CheckCircle2 size={9} />{k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Missing keywords */}
                    {result.missingKeywords.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mb-2">Missing keywords ({result.missingKeywords.length})</p>
                            <div className="flex flex-wrap gap-1.5">
                                {result.missingKeywords.map((k, i) => (
                                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-rose-500/15 border border-rose-500/30 text-rose-300">
                                        <X size={9} />{k}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Tips */}
                    {result.optimizationTips.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400 mb-2">Optimization tips</p>
                            <ul className="space-y-1.5">
                                {result.optimizationTips.map((tip, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                                        <span className="text-indigo-400 shrink-0 mt-0.5">›</span>{tip}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Cover Letter Form ─────────────────────────────────────────────────────
const CoverLetterForm = ({ resumeData, apiBase, getToken }: { resumeData: ResumeData; apiBase: string; getToken: () => Promise<string | null>; }) => {
    const [company, setCompany] = useState('');
    const [role, setRole] = useState('');
    const [hiringManager, setHiringManager] = useState('');
    const [notes, setNotes] = useState('');
    const [content, setContent] = useState('');
    const [generating, setGenerating] = useState(false);

    const generate = async () => {
        setGenerating(true);
        try {
            const token = await getToken();
            const res = await fetch(`${apiBase}/generate-cover-letter`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ resumeData, jobDetails: { title: role, company, hiringManager, notes } }),
            });
            if (res.status === 402) { import('sonner').then(m => m.toast.warning('Add API keys in Settings to generate cover letters')); return; }
            const data = await res.json();
            setContent(data.coverLetter || '');
            import('sonner').then(m => m.toast.success('Cover letter generated!'));
        } catch { import('sonner').then(m => m.toast.error('Failed to generate. Try again.')); }
        finally { setGenerating(false); }
    };

    const copyText = () => { navigator.clipboard.writeText(content); import('sonner').then(m => m.toast.success('Copied!')); };

    const downloadTxt = () => {
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `${resumeData.personal.name || 'Cover'}_Letter.txt`;
        a.click(); URL.revokeObjectURL(url);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
                <div><Label>Company</Label><Input placeholder="e.g. Stripe" value={company} onChange={e => setCompany(e.target.value)} /></div>
                <div><Label>Role / Job Title</Label><Input placeholder="e.g. Senior Engineer" value={role} onChange={e => setRole(e.target.value)} /></div>
                <div><Label>Hiring Manager (optional)</Label><Input placeholder="e.g. Jane Smith" value={hiringManager} onChange={e => setHiringManager(e.target.value)} /></div>
                <div><Label>Notes for AI (optional)</Label><Input placeholder="e.g. Emphasize leadership" value={notes} onChange={e => setNotes(e.target.value)} /></div>
            </div>
            <Button onClick={generate} disabled={generating || !role.trim()} className="w-full bg-pink-600 hover:bg-pink-700 text-white">
                {generating ? <><Loader2 size={14} className="mr-2 animate-spin" />Generating…</> : <><Mail size={14} className="mr-2" />Generate Cover Letter</>}
            </Button>
            {content && (
                <div className="space-y-3 animate-in fade-in">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-zinc-400">Edit your cover letter below:</p>
                        <div className="flex gap-2">
                            <Button size="sm" variant="outline" onClick={copyText}><Copy size={12} className="mr-1.5" />Copy</Button>
                            <Button size="sm" variant="outline" onClick={downloadTxt}><Download size={12} className="mr-1.5" />Download</Button>
                        </div>
                    </div>
                    <textarea
                        value={content}
                        onChange={e => setContent(e.target.value)}
                        rows={18}
                        className="w-full rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-indigo-500/50 resize-y leading-relaxed"
                    />
                </div>
            )}
        </div>
    );
};

// ─── 3-D Interactive Empty State ──────────────────────────────────────────
const EmptyPreview3D = () => {
    const [tilt, setTilt] = useState({ x: 0, y: 0 });
    const [hovered, setHovered] = useState(false);
    const [floatY, setFloatY] = useState(0);
    const containerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number>(0);

    // Smooth floating bob
    useEffect(() => {
        let start = 0;
        const tick = (t: number) => {
            if (!start) start = t;
            setFloatY(Math.sin((t - start) / 1400) * 10);
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, []);

    const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!containerRef.current) return;
        const r = containerRef.current.getBoundingClientRect();
        const nx = (e.clientX - r.left - r.width  / 2) / (r.width  / 2); // -1 → 1
        const ny = (e.clientY - r.top  - r.height / 2) / (r.height / 2); // -1 → 1
        setTilt({ x: ny * 14, y: -nx * 14 }); // rotateX = pitch, rotateY = yaw
    };

    // Glow origin moves opposite to tilt (light-source feel)
    const glowX = 50 - tilt.y * 3;
    const glowY = 50 + tilt.x * 3;

    // Shimmer skeleton line helper
    const Line = ({ w, h = 8, delay = 0, color = '#e2e8f0' }: { w: string; h?: number; delay?: number; color?: string }) => (
        <div style={{
            height: `${h}px`, width: w, borderRadius: `${h / 2}px`,
            background: `linear-gradient(90deg, ${color} 0%, #f8fafc 50%, ${color} 100%)`,
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            marginBottom: '5px',
        }} />
    );

    const Tag = ({ w, delay = 0 }: { w: number; delay?: number }) => (
        <div style={{
            height: '20px', width: `${w}px`, borderRadius: '10px',
            background: 'linear-gradient(90deg, #ede9fe 0%, #f5f3ff 50%, #ede9fe 100%)',
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            flexShrink: 0,
        }} />
    );

    const SectionLabel = ({ delay = 0 }: { delay?: number }) => (
        <div style={{
            height: '9px', width: '80px', borderRadius: '4px',
            background: 'linear-gradient(90deg, #c7d2fe 0%, #e0e7ff 50%, #c7d2fe 100%)',
            backgroundSize: '200% 100%',
            animation: `ep3d-shimmer 2s ${delay}s infinite linear`,
            marginBottom: '10px',
        }} />
    );

    return (
        <div
            ref={containerRef}
            className="flex flex-col items-center justify-center min-h-[600px] select-none overflow-hidden"
            style={{ perspective: '1100px' }}
            onMouseMove={onMove}
            onMouseLeave={() => { setTilt({ x: 0, y: 0 }); setHovered(false); }}
            onMouseEnter={() => setHovered(true)}
        >
            {/* Ambient background orbs */}
            <div style={{ position: 'absolute', width: '300px', height: '300px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(99,102,241,0.08), transparent 70%)', top: '10%', left: '10%', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', width: '200px', height: '200px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(168,85,247,0.08), transparent 70%)', bottom: '15%', right: '15%', pointerEvents: 'none' }} />

            {/* 3-D card */}
            <div style={{
                transform: `rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(${floatY}px) scale(${hovered ? 1.04 : 1})`,
                transition: hovered ? 'transform 0.08s ease-out' : 'transform 0.7s cubic-bezier(0.23,1,0.32,1)',
                transformStyle: 'preserve-3d',
                willChange: 'transform',
            }}>
                {/* Card body */}
                <div style={{
                    width: '340px',
                    background: '#ffffff',
                    borderRadius: '14px',
                    padding: '28px 26px',
                    position: 'relative',
                    overflow: 'hidden',
                    boxShadow: hovered
                        ? `0 35px 90px rgba(99,102,241,0.22), 0 10px 30px rgba(0,0,0,0.12)`
                        : `0 20px 60px rgba(0,0,0,0.13)`,
                    transition: 'box-shadow 0.4s ease',
                }}>

                    {/* Dynamic glow */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
                        background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(99,102,241,0.13) 0%, transparent 60%)`,
                        transition: hovered ? 'background 0.08s' : 'background 0.4s',
                    }} />

                    {/* Holographic sheen */}
                    <div style={{
                        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
                        background: `linear-gradient(${115 + tilt.y * 2.5}deg, rgba(255,255,255,0.55) 0%, transparent 38%, rgba(255,255,255,0.1) 100%)`,
                        opacity: hovered ? 1 : 0.3,
                        transition: 'opacity 0.3s',
                    }} />

                    {/* Content */}
                    <div style={{ position: 'relative', zIndex: 3 }}>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #f1f5f9' }}>
                            <div style={{
                                width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0,
                                background: 'linear-gradient(135deg, #c7d2fe, #ddd6fe)',
                                animation: 'ep3d-pulse 2.5s ease-in-out infinite',
                            }} />
                            <div style={{ flex: 1 }}>
                                <Line w="70%" h={11} delay={0} />
                                <Line w="45%" h={7}  delay={0.15} />
                            </div>
                        </div>

                        {/* Summary */}
                        <SectionLabel delay={0.05} />
                        <Line w="100%" delay={0.1} />
                        <Line w="90%"  delay={0.18} />
                        <Line w="65%"  delay={0.26} />
                        <div style={{ marginBottom: '16px' }} />

                        {/* Experience */}
                        <SectionLabel delay={0.1} />
                        <Line w="55%" h={9} delay={0.2} />
                        <Line w="35%" h={7} delay={0.25} color="#f0fdf4" />
                        <Line w="100%" delay={0.3} />
                        <Line w="85%"  delay={0.35} />
                        <div style={{ marginBottom: '16px' }} />

                        {/* Skills */}
                        <SectionLabel delay={0.15} />
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '20px' }}>
                            {[52, 68, 44, 76, 56, 40].map((w, i) => <Tag key={i} w={w} delay={0.1 + i * 0.06} />)}
                        </div>

                        {/* CTA */}
                        <div style={{
                            textAlign: 'center', padding: '12px 16px',
                            background: 'linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%)',
                            borderRadius: '10px', border: '1.5px dashed #a5b4fc',
                        }}>
                            <p style={{ color: '#6d28d9', fontSize: '11px', fontWeight: 700, margin: 0, letterSpacing: '0.01em' }}>
                                ✨ Fill in your details to see your resume come to life
                            </p>
                        </div>
                    </div>
                </div>

                {/* Reflection / shadow plane */}
                <div style={{
                    position: 'absolute', bottom: '-20px', left: '10%', right: '10%', height: '30px',
                    background: 'radial-gradient(ellipse, rgba(99,102,241,0.18) 0%, transparent 70%)',
                    filter: 'blur(8px)',
                    transform: 'translateZ(-20px)',
                    transition: 'opacity 0.4s',
                    opacity: hovered ? 1 : 0.5,
                }} />
            </div>

            {/* Hint label */}
            <p style={{
                marginTop: '32px', fontSize: '11px', color: '#9ca3af',
                opacity: hovered ? 0.9 : 0.45, transition: 'opacity 0.4s',
                letterSpacing: '0.02em',
            }}>
                {hovered ? 'Hover to explore · Click a section to start' : 'Move cursor over the preview ↑'}
            </p>

            <style>{`
                @keyframes ep3d-shimmer {
                    0%   { background-position: 200% 0; }
                    100% { background-position: -200% 0; }
                }
                @keyframes ep3d-pulse {
                    0%, 100% { opacity: 1; }
                    50%       { opacity: 0.55; }
                }
            `}</style>
        </div>
    );
};

const COLOR_THEMES = [
    { name: 'Slate',    color: '#34495e' },
    { name: 'Violet',   color: '#7c3aed' },
    { name: 'Navy',     color: '#1e40af' },
    { name: 'Forest',   color: '#166534' },
    { name: 'Crimson',  color: '#be123c' },
    { name: 'Midnight', color: '#111827' },
    { name: 'Amber',    color: '#b45309' },
    { name: 'Teal',     color: '#0f766e' },
];

const DesignForm = ({ options, onChange }: { options: StyleOptions, onChange: (field: keyof StyleOptions, value: any) => void }) => {
    const fontFamilies = ['Calibri, sans-serif', 'Georgia, serif', 'Helvetica, sans-serif', 'Verdana, sans-serif', 'Garamond, serif', 'Times New Roman, serif'];
    return (
        <div className="space-y-5">
            {/* Color themes */}
            <div>
                <Label>Color Theme</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                    {COLOR_THEMES.map(t => (
                        <button
                            key={t.color}
                            type="button"
                            onClick={() => onChange('accentColor', t.color)}
                            className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all ${options.accentColor === t.color ? 'border-white/60 bg-white/10' : 'border-white/10 hover:border-white/30'}`}
                        >
                            <div className="w-8 h-8 rounded-full border border-white/20 shadow" style={{ background: t.color }} />
                            <span className="text-[10px] text-zinc-400">{t.name}</span>
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-2 mt-3">
                    <Input id="accent-color" type="color" value={options.accentColor} onChange={e => onChange('accentColor', e.target.value)} className="p-1 h-8 w-12" />
                    <Input type="text" value={options.accentColor} onChange={e => onChange('accentColor', e.target.value)} className="flex-1 text-xs" placeholder="Custom hex" />
                </div>
            </div>

            {/* Font */}
            <div>
                <Label htmlFor="font-family">Font Family</Label>
                <Select id="font-family" value={options.fontFamily} onChange={e => onChange('fontFamily', e.target.value)}>
                    {fontFamilies.map(font => <option key={font} value={font}>{font.split(',')[0]}</option>)}
                </Select>
            </div>

            {/* Font size */}
            <div>
                <Label htmlFor="font-size">Font Size: {options.fontSize}pt</Label>
                <input type="range" min={9} max={13} step={0.5} value={options.fontSize}
                    onChange={e => onChange('fontSize', parseFloat(e.target.value))}
                    className="w-full mt-1 accent-indigo-500" />
                <div className="flex justify-between text-[10px] text-zinc-500 mt-0.5"><span>9pt</span><span>13pt</span></div>
            </div>

            {/* Line spacing */}
            <div>
                <Label>Line Spacing</Label>
                <div className="grid grid-cols-4 gap-2 mt-2">
                    {([1.0, 1.15, 1.5, 2.0] as const).map(s => (
                        <button key={s} type="button"
                            onClick={() => onChange('lineSpacing', s)}
                            className={`py-2 rounded-lg border text-xs font-medium transition-all ${options.lineSpacing === s ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-white/10 text-zinc-400 hover:border-white/30'}`}
                        >{s}×</button>
                    ))}
                </div>
            </div>

            {/* Page margin */}
            <div>
                <Label>Page Margins</Label>
                <div className="grid grid-cols-3 gap-2 mt-2">
                    {(['narrow', 'normal', 'wide'] as const).map(m => (
                        <button key={m} type="button"
                            onClick={() => onChange('pageMargin', m)}
                            className={`py-2 rounded-lg border text-xs font-medium capitalize transition-all ${options.pageMargin === m ? 'border-indigo-500 bg-indigo-500/20 text-indigo-300' : 'border-white/10 text-zinc-400 hover:border-white/30'}`}
                        >{m}</button>
                    ))}
                </div>
            </div>
        </div>
    );
};

// ─── Template Picker ───────────────────────────────────────────────────────
const TEMPLATES: { id: ResumeTemplate; name: string; desc: string; thumb: React.ReactNode }[] = [
    {
        id: 'classic',
        name: 'Classic',
        desc: 'Traditional centered layout with section dividers',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="15" y="8" width="50" height="6" rx="1" fill="#94a3b8" />
                <rect x="25" y="17" width="30" height="3" rx="1" fill="#cbd5e1" />
                <rect x="8" y="26" width="64" height="1" fill="#e2e8f0" />
                <rect x="8" y="31" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="37" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="41" width="48" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="47" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="53" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="57" width="40" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="63" width="25" height="3" rx="1" fill="#6366f1" />
                <rect x="8" y="69" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="73" width="52" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'modern',
        name: 'Modern',
        desc: 'Two-column layout with a colored sidebar',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect width="26" height="100" fill="#6366f110" />
                <rect x="2" y="10" width="22" height="5" rx="1" fill="#6366f1" />
                <rect x="2" y="18" width="22" height="2" rx="1" fill="#cbd5e1" />
                <rect x="2" y="22" width="22" height="2" rx="1" fill="#cbd5e1" />
                <rect x="2" y="30" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="2" y="34" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="38" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="44" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="2" y="48" width="22" height="2" rx="1" fill="#e2e8f0" />
                <rect x="2" y="52" width="18" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="8" width="30" height="4" rx="1" fill="#94a3b8" />
                <rect x="30" y="15" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="20" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="24" width="40" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="31" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="36" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="40" width="35" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="47" width="15" height="2" rx="1" fill="#6366f1" />
                <rect x="30" y="52" width="46" height="2" rx="1" fill="#e2e8f0" />
                <rect x="30" y="56" width="30" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'minimal',
        name: 'Minimal',
        desc: 'Clean typographic layout with generous whitespace',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="8" y="10" width="40" height="5" rx="1" fill="#1e293b" />
                <rect x="8" y="18" width="58" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="28" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="32" width="64" height="1.5" rx="1" fill="#f1f5f9" />
                <rect x="8" y="36" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="40" width="50" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="48" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="52" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="56" width="48" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="64" width="16" height="2" rx="1" fill="#94a3b8" />
                <rect x="8" y="68" width="64" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="8" y="72" width="40" height="1.5" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'creative',
        name: 'Creative',
        desc: 'Full-bleed colored header with clean body layout',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect width="80" height="28" fill="#7c3aed" />
                <rect x="8" y="7" width="36" height="5" rx="1" fill="#fff" />
                <rect x="8" y="15" width="24" height="3" rx="1" fill="#e9d5ff" />
                <rect x="8" y="34" width="20" height="3" rx="1" fill="#7c3aed" />
                <rect x="8" y="40" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="44" width="48" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="52" width="20" height="3" rx="1" fill="#7c3aed" />
                <rect x="8" y="58" width="64" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="62" width="40" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="70" width="20" height="3" rx="1" fill="#7c3aed" />
                <rect x="8" y="76" width="64" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'compact',
        name: 'Compact',
        desc: 'Dense two-column layout for experienced professionals',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="8" y="8" width="44" height="5" rx="1" fill="#1e293b" />
                <rect x="8" y="15" width="64" height="1" rx="1" fill="#6366f1" />
                <rect x="8" y="19" width="55" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="26" width="29" height="36" rx="1" fill="#f8fafc" />
                <rect x="10" y="28" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="10" y="32" width="25" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="10" y="35" width="22" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="10" y="40" width="14" height="2" rx="1" fill="#6366f1" />
                <rect x="10" y="44" width="25" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="10" y="47" width="20" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="42" y="26" width="30" height="2" rx="1" fill="#6366f1" />
                <rect x="42" y="30" width="30" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="42" y="33" width="24" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="42" y="38" width="30" height="2" rx="1" fill="#6366f1" />
                <rect x="42" y="42" width="30" height="1.5" rx="1" fill="#e2e8f0" />
                <rect x="42" y="45" width="22" height="1.5" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
    {
        id: 'executive',
        name: 'Executive',
        desc: 'Bold professional layout with strong accent lines',
        thumb: (
            <svg viewBox="0 0 80 100" className="w-full h-full">
                <rect width="80" height="100" fill="#fff" />
                <rect x="8" y="8" width="48" height="7" rx="1" fill="#1e293b" />
                <rect x="8" y="17" width="64" height="3" rx="0" fill="#6366f1" />
                <rect x="8" y="23" width="45" height="2" rx="1" fill="#cbd5e1" />
                <rect x="8" y="32" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="33" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="38" width="55" height="2" rx="1" fill="#e2e8f0" />
                <rect x="15" y="42" width="42" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="52" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="53" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="58" width="55" height="2" rx="1" fill="#e2e8f0" />
                <rect x="15" y="62" width="35" height="2" rx="1" fill="#e2e8f0" />
                <rect x="8" y="72" width="4" height="12" rx="0" fill="#6366f1" />
                <rect x="15" y="73" width="20" height="3" rx="1" fill="#1e293b" />
                <rect x="15" y="78" width="55" height="2" rx="1" fill="#e2e8f0" />
            </svg>
        ),
    },
];

const TemplatePickerForm = ({ selected, onSelect }: { selected: ResumeTemplate; onSelect: (t: ResumeTemplate) => void }) => (
    <div className="space-y-3">
        <p className="text-sm text-zinc-400">Choose a layout for your resume. The preview updates instantly.</p>
        <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.map(t => (
                <button
                    key={t.id}
                    type="button"
                    onClick={() => onSelect(t.id)}
                    className={`relative rounded-xl border-2 overflow-hidden transition-all text-left ${
                        selected === t.id
                            ? 'border-indigo-500 ring-2 ring-indigo-500/30'
                            : 'border-white/10 hover:border-white/30'
                    }`}
                >
                    <div className="h-32 bg-white">{t.thumb}</div>
                    <div className="p-2 bg-white/5">
                        <p className="text-xs font-semibold text-white">{t.name}</p>
                        <p className="text-[10px] text-zinc-400 leading-tight mt-0.5">{t.desc}</p>
                    </div>
                    {selected === t.id && (
                        <div className="absolute top-1.5 right-1.5 bg-indigo-500 rounded-full p-0.5">
                            <CheckCircle2 size={12} className="text-white" />
                        </div>
                    )}
                </button>
            ))}
        </div>
    </div>
);

// --- Refactored Modal Components ---
const EnhancementModal = ({ isOpen, versions, selected, onSelect, onApply, onClose, originalText }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-2xl text-white">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold text-white">Choose an Enhanced Version</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button>
                </div>
                <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                    {versions.map((version: string, index: number) => (
                        <div key={index} className="p-4 border border-white/20 rounded-lg cursor-pointer hover:bg-white/10 transition-colors" onClick={() => onSelect(version)}>
                            <label className="flex items-start space-x-3">
                                <input type="radio" name="enhancementVersion" checked={selected === version} onChange={() => onSelect(version)} className="mt-1 h-4 w-4 text-indigo-600 border-gray-300 focus:ring-indigo-500" />
                                <span className="text-gray-300 text-sm" dangerouslySetInnerHTML={{ __html: version === originalText ? `<strong>(Original)</strong> ${version}` : version }} />
                            </label>
                        </div>
                    ))}
                </div>
                <div className="mt-6 flex justify-end space-x-3">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={onApply}>Apply Selection</Button>
                </div>
            </div>
        </div>
    );
};

const PitchModal = ({ isOpen, onClose, pitchText, setPitchText, startRecording, stopRecording, isRecording, recordedVideoUrl, videoRef, onVideoFileChange, onUpload, loading, videoBlob }: any) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-zinc-800 rounded-lg shadow-xl p-6 w-full max-w-4xl text-white">
                <div className="flex justify-between items-center mb-4"><h3 className="text-xl font-bold text-white">Your Elevator Pitch</h3><button onClick={onClose} className="text-gray-400 hover:text-white"><X size={24} /></button></div>
                <div className="grid md:grid-cols-2 gap-6">
                    <div>
                        <h4 className="font-semibold mb-2">AI-Generated Script</h4>
                        <Textarea value={pitchText} onChange={e => setPitchText(e.target.value)} rows={12} className="bg-white/10 w-full" />
                        <Button variant="outline" size="sm" className="mt-2" onClick={() => { navigator.clipboard.writeText(pitchText); toast.success("Copied to clipboard!"); }}><Copy size={14} className="mr-2" />Copy Script</Button>
                    </div>
                    <div>
                        <h4 className="font-semibold mb-2">Record or Upload Video</h4>
                        <div className="bg-black rounded-lg aspect-video mb-2 flex items-center justify-center">
                            <video ref={videoRef} src={!isRecording && recordedVideoUrl ? recordedVideoUrl : undefined} controls={!!recordedVideoUrl && !isRecording} className="w-full h-full rounded-lg object-contain bg-black" autoPlay={isRecording} muted={isRecording}></video>
                        </div>
                        <div className="flex justify-center items-center gap-4">
                            {isRecording ? (<Button onClick={stopRecording} variant="destructive"><StopCircle size={16} className="mr-2" />Stop</Button>) : (<Button onClick={startRecording}><Mic size={16} className="mr-2" />Record</Button>)}
                            <Label htmlFor="video-upload" className="cursor-pointer m-0"><Button as="span" variant="outline"><UploadCloud size={16} className="mr-2" />Upload File</Button></Label>
                            <Input id="video-upload" type="file" accept="video/*" className="hidden" onChange={onVideoFileChange} />
                        </div>
                    </div>
                </div>
                <div className="mt-6 flex justify-between">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={onUpload} disabled={!videoBlob || loading}>{loading ? "Uploading..." : <><Upload size={16} className="mr-2" /> Upload Pitch</>}</Button>
                </div>
            </div>
        </div>
    );
};

// --- Main App Component ---
export default function ResumeBuilder() {
    const [activeSection, setActiveSection] = useState<string>('personal');
    const [atsExpanded, setAtsExpanded] = useState(false);
    const [resumeData, setResumeDataState] = useState<ResumeData>({
        personal: { name: '', email: '', phone: '', location: '', legalStatus: 'Prefer not to say', website: '', linkedin: '' },
        summary: '<p></p>',
        experience: [{ id: crypto.randomUUID(), jobTitle: '', company: '', dates: '', description: '<p></p>' }],
        education: [{ id: crypto.randomUUID(), degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }],
        skills: [{ id: crypto.randomUUID(), category: '', skills_list: '' }],
        certifications: [{ id: crypto.randomUUID(), name: '', issuer: '', date: '' }],
        publications: [{ id: crypto.randomUUID(), title: '', authors: '', journal: '', date: '', link: '' }],
        projects: [{ id: crypto.randomUUID(), title: '', date: '', description: '<p></p>' }],
        languages: [],
        volunteer: [],
        awards: [],
    });

    const setResumeData = (action: any) => {
        setResumeDataState(prev => {
            const newState = typeof action === 'function' ? action(prev) : action;
            return newState;
        });
    };


    const [loading, setLoading] = useState<boolean>(false);
    const [profilePic, setProfilePic] = useState<{ preview: string; file: File | null }>({ preview: '', file: null });

    const [showEnhancementModal, setShowEnhancementModal] = useState<boolean>(false);
    const [enhancementVersions, setEnhancementVersions] = useState<string[]>([]);
    const [selectedEnhancement, setSelectedEnhancement] = useState<string>('');
    const [originalText, setOriginalText] = useState<string>('');
    const [enhancementContext, setEnhancementContext] = useState<EnhancementContext | null>(null);
    const [showPitchModal, setShowPitchModal] = useState<boolean>(false);
    const [pitchText, setPitchText] = useState('');
    const [styleOptions, setStyleOptions] = useState<StyleOptions>({ fontFamily: 'Calibri, sans-serif', fontSize: 11, accentColor: '#34495e', lineSpacing: 1.15, pageMargin: 'normal' });
    const [selectedTemplate, setSelectedTemplate] = useState<ResumeTemplate>('classic');
    const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
    const [sectionOrder, setSectionOrder] = useState<string[]>([...DEFAULT_SECTION_ORDER]);
    const [uploadedFileName, setUploadedFileName] = useState<string>('');
    const [summarySuggestions, setSummarySuggestions] = useState<string[]>([]);
    const [suggestionsLoading, setSuggestionsLoading] = useState(false);
    const [newBatchFrom, setNewBatchFrom] = useState(0); // index where the latest generated batch starts
    const [resumeAnalysis, setResumeAnalysis] = useState<any | null>(null);
    const [showAnalysis, setShowAnalysis] = useState(false);
    const [panelWidth, setPanelWidth] = useState(50);
    const isResizing = useRef(false);
    const API_BASE_URL: string = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:5000/api';
    const { user, getToken } = useAuth();

    // ── Saved resume versions ──────────────────────────────────────────────────
    const [savedVersions, setSavedVersions] = useState<{ id: string; name: string; savedAt: string; resumeData: any }[]>([]);
    const [showVersionPanel, setShowVersionPanel] = useState(false);
    const [versionNameInput, setVersionNameInput] = useState('');
    const [savingVersion, setSavingVersion] = useState(false);

    // ── Resume file upload ─────────────────────────────────────────────────────
    const [uploadedFiles, setUploadedFiles] = useState<{ name: string; url: string; uploadedAt: string }[]>([]);
    const [uploadingFile, setUploadingFile] = useState(false);
    const fileUploadRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const loadSavedResume = async () => {
            if (user?.id) {
                try {
                    const docRef = doc(db, 'resumes', user.id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const d = docSnap.data();
                        if (d.resumeData) {
                            setResumeDataState(normalizeResumeData(d.resumeData));
                            toast.success("Loaded your saved resume from cloud!");
                        }
                        setSavedVersions(d.savedVersions ?? []);
                        setUploadedFiles(d.uploadedFiles ?? []);
                    }
                    
                    // Load profile picture from Firestore if exists
                    const userRef = doc(db, 'users', user.id);
                    const userSnap = await getDoc(userRef);
                    if (userSnap.exists() && userSnap.data().profilePicture) {
                        setProfilePic({ preview: userSnap.data().profilePicture, file: null });
                    }
                } catch (error) {
                    console.error("Error loading resume from Firestore:", error);
                }
            }
        };
        loadSavedResume();
    }, [user]);

    const handleSaveResume = async () => {
        if (!user?.id) {
            toast.error("Please log in to save your resume to the cloud!");
            return;
        }
        setLoading(true);
        const toastId = "save-resume";
        toast.info("Saving resume to cloud...", { id: toastId });
        try {
            let profilePicUrl = profilePic.preview;
            if (profilePic.file) {
                const picRef = ref(storage, `users/${user.id}/profile_picture.jpg`);
                await uploadBytes(picRef, profilePic.file);
                profilePicUrl = await getDownloadURL(picRef);
                await setDoc(doc(db, 'users', user.id), { profilePicture: profilePicUrl }, { merge: true });
                setProfilePic({ preview: profilePicUrl, file: null });
            }

            await setDoc(doc(db, 'resumes', user.id), {
                userId: user.id,
                resumeData,
                updatedAt: new Date().toISOString(),
            }, { merge: true });  // merge keeps savedVersions and other fields intact

            toast.success("Resume saved to Cloud Firestore successfully!", { id: toastId });
        } catch (error: any) {
            console.error("Firebase save resume error:", error);
            toast.error(`Failed to save resume: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const handleSaveAsVersion = async () => {
        if (!user?.id) { toast.error('Please log in first'); return; }
        const name = versionNameInput.trim() || `Version ${new Date().toLocaleDateString()}`;
        setSavingVersion(true);
        try {
            const newVersion = { id: crypto.randomUUID(), name, savedAt: new Date().toISOString(), resumeData };
            await setDoc(doc(db, 'resumes', user.id), { savedVersions: arrayUnion(newVersion) }, { merge: true });
            setSavedVersions(prev => [...prev, newVersion]);
            setVersionNameInput('');
            toast.success(`Saved as "${name}"`);
        } catch (e: any) {
            toast.error(`Failed to save version: ${e.message}`);
        } finally { setSavingVersion(false); }
    };

    const handleResumeFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user?.id) return;
        const allowed = ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/msword'];
        if (!allowed.includes(file.type)) { toast.error('Only PDF and DOCX files are supported'); return; }

        setUploadingFile(true);
        const toastId = toast.loading(`Uploading ${file.name}…`);
        try {
            // 1. Upload to Firebase Storage
            const storageRef = ref(storage, `resumes/${user.id}/uploads/${Date.now()}_${file.name}`);
            await uploadBytes(storageRef, file);
            const downloadUrl = await getDownloadURL(storageRef);

            // 2. Store file record in Firestore
            const fileRecord = { name: file.name, url: downloadUrl, uploadedAt: new Date().toISOString() };
            await setDoc(doc(db, 'resumes', user.id), { uploadedFiles: arrayUnion(fileRecord) }, { merge: true });
            setUploadedFiles(prev => [...prev, fileRecord]);

            toast.loading('Parsing resume with AI…', { id: toastId });

            // 3. Parse the file via backend, then save as a named version
            const token = await getToken();
            const formData = new FormData();
            formData.append('file', file);
            const parseRes = await fetch(`${API_BASE_URL}/parse-resume`, {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}` },
                body: formData,
            });
            if (parseRes.ok) {
                const parsed = await parseRes.json();
                const versionName = file.name.replace(/\.[^.]+$/, '');
                const newVersion = { id: crypto.randomUUID(), name: versionName, savedAt: new Date().toISOString(), resumeData: parsed };
                await setDoc(doc(db, 'resumes', user.id), { savedVersions: arrayUnion(newVersion) }, { merge: true });
                setSavedVersions(prev => [...prev, newVersion]);
                toast.success(`Parsed & saved as "${versionName}"`, { id: toastId });
            } else {
                toast.success('File uploaded to cloud storage', { id: toastId });
            }
        } catch (err: any) {
            toast.error(`Upload failed: ${err.message}`, { id: toastId });
        } finally {
            setUploadingFile(false);
            if (fileUploadRef.current) fileUploadRef.current.value = '';
        }
    };

    const handleLoadVersion = (version: { id: string; name: string; savedAt: string; resumeData: any }) => {
        setResumeDataState(normalizeResumeData(version.resumeData));
        toast.success(`Loaded "${version.name}"`);
        setShowVersionPanel(false);
    };

    const handleDeleteVersion = async (versionId: string) => {
        if (!user?.id) return;
        const toDelete = savedVersions.find(v => v.id === versionId);
        if (!toDelete) return;
        try {
            await updateDoc(doc(db, 'resumes', user.id), { savedVersions: arrayRemove(toDelete) });
            setSavedVersions(prev => prev.filter(v => v.id !== versionId));
            toast.success('Version deleted');
        } catch (e: any) {
            toast.error(`Failed to delete: ${e.message}`);
        }
    };

    const handleClearResume = () => {
        setResumeDataState({
            personal: { name: '', email: '', phone: '', location: '', legalStatus: 'Prefer not to say', website: '', linkedin: '' },
            summary: '<p></p>',
            experience: [{ id: crypto.randomUUID(), jobTitle: '', company: '', dates: '', description: '<p></p>' }],
            education: [{ id: crypto.randomUUID(), degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }],
            skills: [{ id: crypto.randomUUID(), category: '', skills_list: '' }],
            certifications: [{ id: crypto.randomUUID(), name: '', issuer: '', date: '' }],
            publications: [{ id: crypto.randomUUID(), title: '', authors: '', journal: '', date: '', link: '' }],
            projects: [{ id: crypto.randomUUID(), title: '', date: '', description: '<p></p>' }],
            languages: [], volunteer: [], awards: [],
        });
        setUploadedFileName('');
        setProfilePic({ preview: '', file: null });
        setSectionOrder([...DEFAULT_SECTION_ORDER]);
        setHiddenSections(new Set());
        toast.success("Cleared. Start building your new resume!");
    };

    const fetchSummarySuggestions = async (dataToUse?: ResumeData, append = true) => {
        const data = dataToUse ?? resumeData;
        setSuggestionsLoading(true);
        try {
            const res = await fetch(`${API_BASE_URL}/generate-summary-suggestions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ resumeData: data }),
            });
            const result = await res.json();
            if (res.status === 402 && result.error === 'no_api_keys') {
                toast.warning('Add your API keys in Profile → Settings to generate AI summaries.', { duration: 6000 });
                return;
            }
            const newOnes: string[] = Array.isArray(result.summaries) ? result.summaries : [];
            if (newOnes.length === 0) { toast.error("No suggestions returned. Try again."); return; }
            if (append) {
                setSummarySuggestions(prev => {
                    setNewBatchFrom(prev.length);
                    return [...prev, ...newOnes];
                });
                toast.success(`${newOnes.length} new suggestions added!`, { id: 'summary-suggest' });
            } else {
                setSummarySuggestions(newOnes);
                setNewBatchFrom(0);
                toast.success("Summary suggestions ready!", { id: 'summary-suggest' });
            }
        } catch {
            toast.error("Failed to generate suggestions. Try again.");
        } finally {
            setSuggestionsLoading(false);
        }
    };

    const handleSaveDraft = async () => {
        if (!user?.id) { toast.error("Please log in to save a draft!"); return; }
        setLoading(true);
        const toastId = "save-draft";
        toast.info("Saving draft...", { id: toastId });
        try {
            await setDoc(doc(db, 'resumeDrafts', user.id), {
                userId: user.id,
                resumeData,
                status: 'draft',
                savedAt: new Date().toISOString(),
            });
            toast.success("Draft saved! You can continue editing anytime.", { id: toastId });
        } catch (error: any) {
            toast.error(`Failed to save draft: ${error.message}`, { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    const [isRecording, setIsRecording] = useState(false);
    const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);

    const handlePersonalChange = (field: keyof PersonalInfo, value: string) => { setResumeData((prev: ResumeData) => ({ ...prev, personal: { ...prev.personal, [field]: value } })); };
    const handleSummaryChange = (value: string) => { setResumeData((prev: ResumeData) => ({...prev, summary: value})); };
    const handleDynamicChange = <T extends ExperienceEntry | EducationEntry | SkillCategory | CertificationEntry | PublicationEntry | ProjectEntry>(section: keyof ResumeData, index: number, field: keyof T, value: any) => {
        setResumeData((prev: ResumeData) => {
            const newList = [...(prev[section] as T[])];
            newList[index] = { ...newList[index], [field]: value };
            return { ...prev, [section]: newList };
        });
    };

    const handleProfilePicChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files?.[0]) {
            const file = event.target.files[0];
            setProfilePic({ preview: URL.createObjectURL(file), file });
            toast.success("Profile picture selected.");
        }
    };
    
    const handleProfilePicRemove = () => {
        if(profilePic.preview) { URL.revokeObjectURL(profilePic.preview); }
        setProfilePic({ preview: '', file: null });
        toast.info("Profile picture removed.");
    };

    const handleStyleChange = (field: keyof StyleOptions, value: any) => {
        setStyleOptions(prev => ({...prev, [field]: value}));
    };

    const addDynamicEntry = (section: keyof ResumeData, newEntry: any) => setResumeData((prev: ResumeData) => ({ ...prev, [section]: [...(prev[section] as any[]), { ...newEntry, id: crypto.randomUUID() }] }));
    const removeDynamicEntry = (section: keyof ResumeData, id: string) => setResumeData((prev: ResumeData) => ({ ...prev, [section]: (prev[section] as any[]).filter(item => item.id !== id) }));

    const moveSectionUp   = (id: string) => setSectionOrder(prev => { const i = prev.indexOf(id); if (i <= 0) return prev; const n = [...prev]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; });
    const moveSectionDown = (id: string) => setSectionOrder(prev => { const i = prev.indexOf(id); if (i >= prev.length - 1) return prev; const n = [...prev]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; });
    const toggleSectionVisibility = (id: string) => setHiddenSections(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const handleMouseDown = (e: React.MouseEvent) => { e.preventDefault(); isResizing.current = true; document.body.style.cursor = 'col-resize'; };
    const handleMouseUp = useCallback(() => { isResizing.current = false; document.body.style.cursor = 'default'; }, []);
    const handleMouseMove = useCallback((e: MouseEvent) => { if (!isResizing.current) return; const newWidth = (e.clientX / window.innerWidth) * 100; if (newWidth > 25 && newWidth < 75) { setPanelWidth(newWidth); } }, []);
    useEffect(() => { window.addEventListener('mousemove', handleMouseMove); window.addEventListener('mouseup', handleMouseUp); return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); }; }, [handleMouseMove, handleMouseUp]);

    const normalizeResumeData = (data: any): ResumeData => {
        const defaultHtmlValue = '<p></p>';
        const defaultPlainValue = '';

        const normalized = { ...data };

        normalized.experience = Array.isArray(normalized.experience) ? normalized.experience : [];
        normalized.education = Array.isArray(normalized.education) ? normalized.education : [];
        normalized.skills = Array.isArray(normalized.skills) ? normalized.skills : [];
        normalized.certifications = Array.isArray(normalized.certifications) ? normalized.certifications : [];
        normalized.publications = Array.isArray(normalized.publications) ? normalized.publications : [];
        normalized.projects = Array.isArray(normalized.projects) ? normalized.projects : [];


        normalized.languages = Array.isArray(normalized.languages) ? normalized.languages : [];
        normalized.volunteer  = Array.isArray(normalized.volunteer)  ? normalized.volunteer  : [];
        normalized.awards     = Array.isArray(normalized.awards)     ? normalized.awards     : [];

        normalized.personal = {
            name: typeof normalized.personal?.name === 'string' ? normalized.personal.name : '',
            email: typeof normalized.personal?.email === 'string' ? normalized.personal.email : '',
            phone: typeof normalized.personal?.phone === 'string' ? normalized.personal.phone : '',
            location: typeof normalized.personal?.location === 'string' ? normalized.personal.location : '',
            legalStatus: typeof normalized.personal?.legalStatus === 'string' ? normalized.personal.legalStatus : 'Prefer not to say',
            website: typeof normalized.personal?.website === 'string' ? normalized.personal.website : '',
            linkedin: typeof normalized.personal?.linkedin === 'string' ? normalized.personal.linkedin : '',
        };

        normalized.summary = toEditorHtml(typeof normalized.summary === 'string' ? normalized.summary : '');

        normalized.experience = normalized.experience.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            jobTitle: typeof item.jobTitle === 'string' ? item.jobTitle : '',
            company: typeof item.company === 'string' ? item.company : '',
            dates: typeof item.dates === 'string' ? item.dates : '',
            description: toEditorHtml(typeof item.description === 'string' ? item.description : '')
        }));
        normalized.education = normalized.education.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            degree: typeof item.degree === 'string' ? item.degree : '',
            institution: typeof item.institution === 'string' ? item.institution : '',
            graduationYear: typeof item.graduationYear === 'string' ? item.graduationYear : '',
            gpa: typeof item.gpa === 'string' ? item.gpa : '',
            achievements: toEditorHtml(typeof item.achievements === 'string' ? item.achievements : '')
        }));
        normalized.skills = normalized.skills.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            category: typeof item.category === 'string' ? item.category : '',
            skills_list: typeof item.skills_list === 'string' ? (item.skills_list || defaultPlainValue) : defaultPlainValue,
        }));
        normalized.projects = normalized.projects.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : '',
            date: typeof item.date === 'string' ? item.date : '',
            description: toEditorHtml(typeof item.description === 'string' ? item.description : ''),
        }));
        normalized.publications = normalized.publications.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : '',
            authors: typeof item.authors === 'string' ? item.authors : '',
            journal: typeof item.journal === 'string' ? item.journal : '',
            date: typeof item.date === 'string' ? item.date : '',
            link: typeof item.link === 'string' ? item.link : '',
        }));
        normalized.certifications = normalized.certifications.map( (item: any) => ({
            id: item.id || crypto.randomUUID(),
            name: typeof item.name === 'string' ? item.name : '',
            issuer: typeof item.issuer === 'string' ? item.issuer : '',
            date: typeof item.date === 'string' ? item.date : '',
        }));
        normalized.languages = normalized.languages.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            language: typeof item.language === 'string' ? item.language : '',
            proficiency: typeof item.proficiency === 'string' ? item.proficiency : 'Conversational',
        }));
        normalized.volunteer = normalized.volunteer.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            role: typeof item.role === 'string' ? item.role : '',
            organization: typeof item.organization === 'string' ? item.organization : '',
            dates: typeof item.dates === 'string' ? item.dates : '',
            description: toEditorHtml(typeof item.description === 'string' ? item.description : ''),
        }));
        normalized.awards = normalized.awards.map((item: any) => ({
            id: item.id || crypto.randomUUID(),
            title: typeof item.title === 'string' ? item.title : '',
            organization: typeof item.organization === 'string' ? item.organization : '',
            date: typeof item.date === 'string' ? item.date : '',
            description: toEditorHtml(typeof item.description === 'string' ? item.description : ''),
        }));

        return normalized;
    };


    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setLoading(true);
        const toastId = "upload";
        toast.info("Parsing resume...", { id: toastId });

        const formData = new FormData();
        formData.append('file', file);

        try {
            let customKey = '';
            if (typeof window !== 'undefined' && user?.id) {
                const savedEncryptedKey = localStorage.getItem('user_gemini_api_key') || '';
                if (savedEncryptedKey) {
                    customKey = await decryptApiKey(savedEncryptedKey, user.id);
                }
            }
            const response = await fetch(`${API_BASE_URL}/parse-resume`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${await getToken()}`,
                    'X-Gemini-API-Key': customKey
                },
                body: formData
            });

            const result = await response.json();

            if (!response.ok || result.error) {
                throw new Error(result.error || 'Server responded with an error');
            }

            if (!result.parsedData || Object.keys(result.parsedData).length === 0) {
                throw new Error('Resume parsing returned empty data. Check your Gemini API key in profile settings.');
            }

            const normalizedData = normalizeResumeData(result.parsedData);
            setResumeDataState(normalizedData);
            setUploadedFileName(file.name);
            toast.success("Resume parsed successfully!", { id: toastId });

            // Run quality analysis in background
            try {
                const analysisRes = await fetch(`${API_BASE_URL}/resume/analyze`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${await getToken()}`,
                    },
                    body: JSON.stringify({ resumeData: result.parsedData }),
                });
                if (analysisRes.ok) {
                    const analysisData = await analysisRes.json();
                    setResumeAnalysis(analysisData);
                    setShowAnalysis(true);
                }
            } catch {
                // Non-critical — analysis is best-effort
            }

            // Auto-suggest summaries if none found
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = normalizedData.summary || '';
            const summaryText = tempDiv.textContent?.trim() || '';
            if (!summaryText) {
                setSummarySuggestions([]);
                setNewBatchFrom(0);
                setActiveSection('summary');
                toast.info("No summary found — generating suggestions…", { id: 'summary-suggest', duration: 8000 });
                fetchSummarySuggestions(normalizedData, false);
            }
        } catch (error: any) {
            toast.error(error.message || 'Failed to parse resume.', { id: toastId });
            console.error("Frontend file upload error:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleEnhance = async (context: EnhancementContext) => {
        let textToEnhance: string = ''; let sectionNameForApi: string = '';
        if (context.section === 'summary') { textToEnhance = resumeData.summary; sectionNameForApi = 'Summary'; }
        else if (context.section === 'experience') { textToEnhance = resumeData.experience[context.index].description; sectionNameForApi = 'Experience Description';}
        else if (context.section === 'education') { textToEnhance = resumeData.education[context.index].achievements; sectionNameForApi = 'Education Achievements'; }
        else if (context.section === 'projects') { textToEnhance = resumeData.projects[context.index].description; sectionNameForApi = 'Project Description';}
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = textToEnhance;
        let contentForCheck = tempDiv.textContent || '';
        
        if (!contentForCheck.trim()) {
            toast.info("Field is empty, nothing to enhance."); return;
        }

        setEnhancementContext(context); setOriginalText(textToEnhance); setLoading(true); toast.info(`Enhancing ${sectionNameForApi}...`);
        try {
            const response = await fetch(`${API_BASE_URL}/enhance-section`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ sectionName: sectionNameForApi, textToEnhance })
            });
            const result = await response.json();
            if (response.status === 402 && result.error === 'no_api_keys') {
                toast.warning('Add your API keys in Profile → Settings to use AI enhancement.', { duration: 6000 });
                return;
            }
            if (!response.ok) throw new Error('Enhancement failed');
            if (Array.isArray(result.enhancedVersions) && result.enhancedVersions.length > 0) {
                const processedVersions = result.enhancedVersions.map((v: string) => toEditorHtml(v));
                setEnhancementVersions([textToEnhance, ...processedVersions]);
                setSelectedEnhancement(textToEnhance);
                setShowEnhancementModal(true);
                toast.success("AI suggestions ready!");
            } else { toast.info("No new suggestions were generated."); }
        } catch (error: any) { toast.error(error.message); } finally { setLoading(false); }
    };

    const handleApplyEnhancement = () => {
        if (!enhancementContext) return;
        const { section } = enhancementContext;
        if (section === 'summary') { handleSummaryChange(selectedEnhancement); }
        else {
            const index = (enhancementContext as any).index;
            if (section === 'experience') { handleDynamicChange('experience', index, 'description' as any, selectedEnhancement); }
            else if (section === 'education') { handleDynamicChange('education', index, 'achievements' as any, selectedEnhancement); }
            else if (section === 'projects') { handleDynamicChange('projects', index, 'description' as any, selectedEnhancement); }
        }
        setShowEnhancementModal(false); toast.success("Section updated!");
    };

    const handleGeneratePitch = async () => {
        setLoading(true); toast.info("Generating Elevator Pitch...", {id: 'pitch'});
        try {
            const response = await fetch(`${API_BASE_URL}/generate-elevator-pitch`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await getToken()}`,
                },
                body: JSON.stringify({ resumeData })
            });
            const result = await response.json();
            if (response.status === 402 && result.error === 'no_api_keys') {
                toast.warning('Add your API keys in Profile → Settings to generate an elevator pitch.', { duration: 6000 });
                return;
            }
            if (!response.ok) throw new Error('Failed to generate pitch');
            setPitchText(result.elevatorPitch);
            setShowPitchModal(true);
            toast.success("Elevator pitch generated!", {id: 'pitch'});
        } catch (error: any) { toast.error(error.message, {id: 'pitch'}); } finally { setLoading(false); }
    };

    // --- FULLY INTEGRATED VIDEO HANDLERS ---
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) { videoRef.current.srcObject = stream; }
            setIsRecording(true); setRecordedVideoUrl(null); setVideoBlob(null);
            const mediaRecorder = new MediaRecorder(stream);
            mediaRecorderRef.current = mediaRecorder;
            const chunks: BlobPart[] = [];
            mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) { chunks.push(event.data); } };
            mediaRecorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'video/webm' });
                setVideoBlob(blob);
                const url = URL.createObjectURL(blob);
                setRecordedVideoUrl(url);
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
        } catch (err) { toast.error("Could not access camera/microphone. Please check permissions."); console.error("Error starting recording:", err); }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') { mediaRecorderRef.current.stop(); }
        setIsRecording(false);
    };

    const handleVideoFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) { setVideoBlob(file); setRecordedVideoUrl(URL.createObjectURL(file)); toast.success("Video file selected."); }
    };

    const handleUploadPitchVideo = async () => {
        if (!videoBlob) { toast.error("No video to upload!"); return; }
        if (!user?.id) { toast.error("Please sign in to upload your pitch!"); return; }
        setLoading(true); toast.info("Uploading video pitch to Firebase...", { id: 'upload-pitch' });
        try {
            const fileRef = ref(storage, `users/${user.id}/pitches/${Date.now()}.webm`);
            await uploadBytes(fileRef, videoBlob);
            const downloadUrl = await getDownloadURL(fileRef);
            
            // Save elevator pitch video URL to User collection in Firestore
            await setDoc(doc(db, 'users', user.id), { elevatorPitchUrl: downloadUrl }, { merge: true });
            
            toast.success("Video pitch uploaded to Firebase successfully!", { id: 'upload-pitch' });
        } catch (error: any) {
            console.error("Firebase video pitch upload error:", error);
            toast.error(`Upload failed: ${error.message}`, { id: 'upload-pitch' });
        } finally {
            setLoading(false);
        }
    };


    // --- FULLY INTEGRATED DOWNLOAD HANDLER ---
    const handleDownload = async (type: 'PDF' | 'DOCX') => {
        const endpoint = type === 'PDF' ? '/generate-pdf' : '/generate-docx';
        const filename = `${resumeData.personal.name.replace(/\s/g, '_')}_Resume.${type.toLowerCase()}`;
        const toastId = `${type.toLowerCase()}-download`;

        toast.info(`Generating ${type} file...`, { id: toastId, duration: 15000 });
        setLoading(true);

        try {
            const response = await fetch(`${API_BASE_URL}/${type === 'PDF' ? 'generate-pdf' : 'generate-docx'}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...resumeData, styleOptions })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Server responded with an error');
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            
            toast.success(`${type} downloaded successfully!`, { id: toastId });

        } catch (error: any) {
            toast.error(`Failed to generate ${type}: ${error.message}`, { id : toastId });
            console.error(error);
        } finally {
            setLoading(false);
        }
    };
    
    const isResumeEmpty = (): boolean => {
        const { personal, summary, experience, education } = resumeData;
        const tempDiv = typeof document !== 'undefined' ? document.createElement('div') : null;
        if (tempDiv) tempDiv.innerHTML = summary || '';
        const summaryText = tempDiv?.textContent?.trim() || '';
        return !personal.name.trim() &&
               !personal.email.trim() &&
               !summaryText &&
               !(experience[0]?.jobTitle || '').trim() &&
               !(education[0]?.degree  || '').trim();
    };

    const renderResumePreview = () => {
        if (isResumeEmpty()) return <EmptyPreview3D />;

        const { personal, summary, experience, education, skills, certifications, publications, projects } = resumeData;
        const ac = styleOptions.accentColor;
        const ff = styleOptions.fontFamily;
        const fs = `${styleOptions.fontSize}pt`;
        const contactDetails = [
            personal.email, personal.phone, personal.location,
            (personal.legalStatus && personal.legalStatus !== 'Prefer not to say') ? personal.legalStatus : null
        ].filter(Boolean).join(' | ');

        const hasExp = (experience || []).some(e => (e.jobTitle || '').trim() || (e.description || '').trim());
        const hasEdu = (education || []).some(e => (e.degree || '').trim());
        const hasSkills = (skills || []).some(e => (e.skills_list || '').trim());
        const hasProj = (projects || []).some((p: any) => (p.title || '').trim() || (p.description || '').trim());
        const hasPubs = (publications || []).some(e => (e.title || '').trim());
        const hasCerts = (certifications || []).some(e => (e.name || '').trim());

        const hasLangs  = (resumeData.languages || []).some(e => (e.language || '').trim());
        const hasVol    = (resumeData.volunteer  || []).some(e => (e.role || '').trim());
        const hasAwards = (resumeData.awards     || []).some(e => (e.title || '').trim());

        const marginMap = { narrow: '16px 20px', normal: '28px 32px', wide: '36px 48px' };
        const padding = marginMap[styleOptions.pageMargin] || '28px 32px';

        const baseClass = "bg-white rounded-lg border border-gray-300 min-h-[600px] quill-content-container text-gray-900";
        const baseStyle: React.CSSProperties = { fontFamily: ff, fontSize: fs, lineHeight: styleOptions.lineSpacing ?? 1.5, color: '#1a1a1a' };

        const sectionVisible = (key: string) => !hiddenSections.has(key);

        if (selectedTemplate === 'modern') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, display: 'flex', padding: 0, overflow: 'hidden' }}>
                    {/* Sidebar */}
                    <div style={{ width: '30%', backgroundColor: ac + '12', borderRight: `3px solid ${ac}`, padding: '24px 14px', flexShrink: 0 }}>
                        {profilePic.preview && <img src={profilePic.preview} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ac}`, marginBottom: '12px' }} />}
                        <h2 style={{ fontSize: '16px', fontWeight: 'bold', color: ac, marginBottom: '4px' }}>{personal.name || 'Your Name'}</h2>
                        <p style={{ fontSize: '9pt', color: '#555', marginBottom: '16px', lineHeight: 1.6 }}>
                            {[personal.email, personal.phone, personal.location].filter(Boolean).map((d, i) => <span key={i} style={{ display: 'block' }}>{d}</span>)}
                        </p>
                        {hasSkills && <>
                            <p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1px solid ${ac}`, paddingBottom: '3px', marginBottom: '8px' }}>Skills</p>
                            {(skills || []).map(skill => <div key={skill.id} style={{ marginBottom: '6px' }}>
                                {skill.category && <p style={{ fontWeight: 600, fontSize: '8pt', color: '#333' }}>{skill.category}</p>}
                                <p style={{ fontSize: '8pt', color: '#555' }}>{skill.skills_list || ''}</p>
                            </div>)}
                        </>}
                        {hasCerts && <>
                            <p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1px solid ${ac}`, paddingBottom: '3px', marginTop: '12px', marginBottom: '8px' }}>Certifications</p>
                            {(certifications || []).map(cert => <div key={cert.id} style={{ fontSize: '8pt', marginBottom: '4px', color: '#444' }}><b>{cert.name}</b>{cert.date && <span> · {cert.date}</span>}</div>)}
                        </>}
                    </div>
                    {/* Main */}
                    <div style={{ flex: 1, padding: '24px 20px' }}>
                        {(summary || '').trim() && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, marginBottom: '4px' }}>Summary</p><div style={{ fontSize: '9pt', marginBottom: '14px' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></>}
                        {hasExp && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px' }}>Experience</p>{(experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '10px' }}><b style={{ fontSize: '10pt' }}>{exp.jobTitle}</b><p style={{ color: '#555', fontSize: '9pt' }}>{exp.company}{exp.dates && ` | ${exp.dates}`}</p><div style={{ fontSize: '9pt' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>)}</>}
                        {hasEdu && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Education</p>{(education || []).map(edu => <div key={edu.id} style={{ marginBottom: '8px' }}><b style={{ fontSize: '10pt' }}>{edu.degree}</b><p style={{ color: '#555', fontSize: '9pt' }}>{edu.institution}{edu.graduationYear && ` · ${edu.graduationYear}`}{edu.gpa && ` · GPA: ${edu.gpa}`}</p></div>)}</>}
                        {hasProj && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Projects</p>{(projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '8px' }}><b style={{ fontSize: '10pt' }}>{proj.title}</b>{proj.date && <span style={{ color: '#777', fontSize: '9pt' }}> ({proj.date})</span>}<div style={{ fontSize: '9pt' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>)}</>}
                        {hasPubs && <><p style={{ fontWeight: 700, fontSize: '9pt', textTransform: 'uppercase', letterSpacing: '1px', color: ac, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px' }}>Publications</p>{(publications || []).map(pub => <div key={pub.id} style={{ marginBottom: '6px', fontSize: '9pt' }}><b>{pub.title}</b><p style={{ color: '#666' }}>{pub.authors} — <i>{pub.journal}</i>{pub.date && ` (${pub.date})`}</p></div>)}</>}
                    </div>
                </div>
            );
        }

        if (selectedTemplate === 'minimal') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding: '40px 48px' }}>
                    <h2 style={{ fontSize: '28pt', fontWeight: 300, letterSpacing: '4px', textTransform: 'uppercase', color: '#0f172a', marginBottom: '4px' }}>{personal.name || 'Your Name'}</h2>
                    <p style={{ fontSize: '9pt', color: '#94a3b8', letterSpacing: '1px', marginBottom: '32px' }}>{contactDetails}</p>
                    {(summary || '').trim() && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Profile</p><div style={{ fontSize: '9pt', color: '#374151', marginBottom: '24px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></>}
                    {hasExp && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Experience</p><div style={{ marginBottom: '24px' }}>{(experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '12px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{exp.jobTitle}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{exp.dates}</span></div><p style={{ fontSize: '9pt', color: '#64748b', marginBottom: '4px' }}>{exp.company}</p><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>)}</div></>}
                    {hasEdu && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Education</p><div style={{ marginBottom: '24px' }}>{(education || []).map(edu => <div key={edu.id} style={{ marginBottom: '8px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{edu.degree}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{edu.graduationYear}</span></div><p style={{ fontSize: '9pt', color: '#64748b' }}>{edu.institution}{edu.gpa && ` · ${edu.gpa}`}</p></div>)}</div></>}
                    {hasSkills && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Skills</p><div style={{ marginBottom: '24px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{(skills || []).flatMap(s => (s.skills_list || '').split(',').map(sk => sk.trim()).filter(Boolean)).map((sk, i) => <span key={i} style={{ fontSize: '8pt', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', color: '#475569' }}>{sk}</span>)}</div></>}
                    {hasProj && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Projects</p><div style={{ marginBottom: '24px' }}>{(projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '10px', paddingLeft: '12px', borderLeft: '2px solid #e2e8f0' }}><div style={{ display: 'flex', justifyContent: 'space-between' }}><b style={{ fontSize: '10pt', color: '#0f172a' }}>{proj.title}</b><span style={{ fontSize: '8pt', color: '#94a3b8' }}>{proj.date}</span></div><div style={{ fontSize: '9pt', color: '#374151', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>)}</div></>}
                    {hasPubs && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Publications</p><div style={{ marginBottom: '24px' }}>{(publications || []).map(pub => <div key={pub.id} style={{ fontSize: '9pt', marginBottom: '6px', color: '#374151' }}><b>{pub.title}</b> · {pub.authors} · <i>{pub.journal}</i>{pub.date && ` · ${pub.date}`}</div>)}</div></>}
                    {hasCerts && <><p style={{ fontSize: '7pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '2px', color: '#64748b', marginBottom: '6px' }}>Certifications</p><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{(certifications || []).map(cert => <span key={cert.id} style={{ fontSize: '8pt', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '2px 8px', color: '#475569' }}>{cert.name}{cert.issuer && ` · ${cert.issuer}`}</span>)}</div></>}
                </div>
            );
        }

        if (selectedTemplate === 'executive') {
            return (
                <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding: '36px 40px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '4px' }}>
                        <h2 style={{ fontSize: '30pt', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px' }}>{personal.name || 'Your Name'}</h2>
                        {profilePic.preview && <img src={profilePic.preview} alt="Profile" style={{ width: '68px', height: '68px', borderRadius: '6px', objectFit: 'cover', border: `2px solid ${ac}` }} />}
                    </div>
                    <div style={{ height: '4px', background: `linear-gradient(90deg, ${ac}, ${ac}88)`, borderRadius: '2px', marginBottom: '8px' }} />
                    <p style={{ fontSize: '9pt', color: '#64748b', marginBottom: '28px' }}>{contactDetails}</p>
                    {(summary || '').trim() && <div style={{ marginBottom: '20px', padding: '12px 16px', background: ac + '08', borderRadius: '4px', borderLeft: `4px solid ${ac}` }}><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></div>}
                    {[
                        { show: hasExp, label: 'Professional Experience', content: (experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '14px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{exp.jobTitle}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{exp.dates}</span></div><p style={{ color: ac, fontSize: '9pt', fontWeight: 600, marginBottom: '4px' }}>{exp.company}</p><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>) },
                        { show: hasEdu, label: 'Education', content: (education || []).map(edu => <div key={edu.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{edu.degree}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{edu.graduationYear}</span></div><p style={{ color: '#64748b', fontSize: '9pt' }}>{edu.institution}{edu.gpa && ` · GPA ${edu.gpa}`}</p></div>) },
                        { show: hasSkills, label: 'Core Competencies', content: <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '4px' }}>{(skills || []).flatMap(s => (s.skills_list || '').split(',').map(sk => sk.trim()).filter(Boolean)).map((sk, i) => <span key={i} style={{ fontSize: '8pt', background: ac + '15', border: `1px solid ${ac}55`, borderRadius: '4px', padding: '3px 10px', color: '#0f172a', fontWeight: 500 }}>{sk}</span>)}</div> },
                        { show: hasProj, label: 'Key Projects', content: (projects || []).map((proj: any) => <div key={proj.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{proj.title}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{proj.date}</span></div><div style={{ fontSize: '9pt', color: '#374151' }} dangerouslySetInnerHTML={{ __html: proj.description || '' }} /></div>) },
                        { show: hasPubs, label: 'Publications', content: (publications || []).map(pub => <div key={pub.id} style={{ fontSize: '9pt', marginBottom: '6px' }}><b>{pub.title}</b> — {pub.authors} · <i>{pub.journal}</i>{pub.date && ` (${pub.date})`}</div>) },
                        { show: hasCerts, label: 'Certifications', content: (certifications || []).map(cert => <div key={cert.id} style={{ fontSize: '9pt', marginBottom: '4px' }}><b>{cert.name}</b>{cert.issuer && ` · ${cert.issuer}`}{cert.date && ` · ${cert.date}`}</div>) },
                    ].filter(s => s.show).map(s => (
                        <div key={s.label} style={{ marginBottom: '20px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                <div style={{ width: '5px', height: '20px', background: ac, borderRadius: '2px', flexShrink: 0 }} />
                                <h3 style={{ fontSize: '11pt', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '1px' }}>{s.label}</h3>
                            </div>
                            {s.content}
                        </div>
                    ))}
                </div>
            );
        }

        const SH = ({ label }: { label: string }) => (
            <h3 style={{ fontSize: '11pt', fontWeight: 700, borderBottom: `1.5px solid ${ac}`, paddingBottom: '2px', marginBottom: '8px', marginTop: '14px', color: ac, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</h3>
        );

        const sectionBlocks: Record<string, React.ReactNode> = {
            summary: (summary || '').trim() ? <div key="summary"><SH label="Summary" /><div style={{ fontSize: fs, color: '#374151' }} dangerouslySetInnerHTML={{ __html: summary || '' }} /></div> : null,
            experience: hasExp ? <div key="experience"><SH label="Experience" />{(experience || []).map(exp => <div key={exp.id} style={{ marginBottom: '10px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt', color: '#0f172a' }}>{exp.jobTitle}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{exp.dates}</span></div><p style={{ color: ac, fontSize: '9pt', fontWeight: 600, marginBottom: '3px' }}>{exp.company}</p><div style={{ fontSize: fs, color: '#374151' }} dangerouslySetInnerHTML={{ __html: exp.description || '' }} /></div>)}</div> : null,
            education: hasEdu ? <div key="education"><SH label="Education" />{(education || []).map(edu => <div key={edu.id} style={{ marginBottom: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt' }}>{edu.degree}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{edu.graduationYear}</span></div><p style={{ color: '#64748b', fontSize: '9pt' }}>{edu.institution}{edu.gpa && ` · GPA ${edu.gpa}`}</p>{edu.achievements && (edu.achievements !== '<p></p>') && <div style={{ fontSize: fs, color: '#374151', marginTop: '2px' }} dangerouslySetInnerHTML={{ __html: edu.achievements }} />}</div>)}</div> : null,
            skills: hasSkills ? <div key="skills"><SH label="Skills" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>{(skills || []).flatMap(s => (s.skills_list || '').split(',').map(sk => sk.trim()).filter(Boolean)).map((sk, i) => <span key={i} style={{ fontSize: '9pt', background: ac + '12', border: `1px solid ${ac}30`, borderRadius: '4px', padding: '2px 8px', color: '#1e293b' }}>{sk}</span>)}</div></div> : null,
            projects: hasProj ? <div key="projects"><SH label="Projects" />{(projects || []).map((p: any) => <div key={p.id} style={{ marginBottom: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt' }}>{p.title}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{p.date}</span></div><div style={{ fontSize: fs, color: '#374151' }} dangerouslySetInnerHTML={{ __html: p.description || '' }} /></div>)}</div> : null,
            certifications: hasCerts ? <div key="certifications"><SH label="Certifications" />{(certifications || []).map(c => <div key={c.id} style={{ marginBottom: '4px', fontSize: fs, color: '#374151' }}><b>{c.name}</b>{c.issuer && ` · ${c.issuer}`}{c.date && ` · ${c.date}`}</div>)}</div> : null,
            publications: hasPubs ? <div key="publications"><SH label="Publications" />{(publications || []).map(p => <div key={p.id} style={{ marginBottom: '6px', fontSize: fs, color: '#374151' }}><b>{p.title}</b> · {p.authors} · <i>{p.journal}</i>{p.date && ` · ${p.date}`}</div>)}</div> : null,
            languages: hasLangs ? <div key="languages"><SH label="Languages" /><div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{(resumeData.languages || []).filter(l => l.language.trim()).map(l => <span key={l.id} style={{ fontSize: '9pt', background: ac + '12', border: `1px solid ${ac}30`, borderRadius: '4px', padding: '2px 8px', color: '#1e293b' }}>{l.language}<span style={{ color: '#64748b', marginLeft: '4px' }}>({l.proficiency})</span></span>)}</div></div> : null,
            volunteer: hasVol ? <div key="volunteer"><SH label="Volunteer Work" />{(resumeData.volunteer || []).map((v: any) => <div key={v.id} style={{ marginBottom: '8px' }}><div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}><b style={{ fontSize: '11pt' }}>{v.role}</b><span style={{ fontSize: '9pt', color: '#64748b' }}>{v.dates}</span></div><p style={{ color: ac, fontSize: '9pt', fontWeight: 600 }}>{v.organization}</p><div style={{ fontSize: fs, color: '#374151' }} dangerouslySetInnerHTML={{ __html: v.description || '' }} /></div>)}</div> : null,
            awards: hasAwards ? <div key="awards"><SH label="Awards &amp; Honors" />{(resumeData.awards || []).map((a: any) => <div key={a.id} style={{ marginBottom: '6px', fontSize: fs, color: '#374151' }}><b>{a.title}</b>{a.organization && ` · ${a.organization}`}{a.date && ` · ${a.date}`}{a.description && (a.description !== '<p></p>') && <div dangerouslySetInnerHTML={{ __html: a.description }} />}</div>)}</div> : null,
        };

        // Default: Classic
        return (
            <div id="resume-preview-content" className={baseClass} style={{ ...baseStyle, padding }}>
                <div style={{ textAlign: 'center', marginBottom: '20px', paddingBottom: '14px', borderBottom: `2px solid ${ac}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                        <h2 style={{ fontSize: '26pt', fontWeight: 800, color: ac, marginBottom: '4px' }}>{personal.name || 'Your Name'}</h2>
                        <p style={{ color: '#64748b', fontSize: '9pt' }}>
                            {[personal.email, personal.phone, personal.location, personal.website, personal.linkedin].filter(Boolean).join(' · ')}
                        </p>
                    </div>
                    {profilePic.preview && <img src={profilePic.preview} alt="Profile" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: `2px solid ${ac}` }} />}
                </div>
                {sectionOrder.filter(k => !hiddenSections.has(k)).map(k => sectionBlocks[k] || null)}
            </div>
        );
    };
    
    // Grouped by what the user is doing: writing content, using AI tools,
    // or adjusting layout. Order inside "Content" mirrors the resume itself.
    const sectionGroups = [
        { label: 'Content', items: [
            { id: 'personal',       name: 'Personal',       icon: <User size={16} /> },
            { id: 'summary',        name: 'Summary',        icon: <FileText size={16} /> },
            { id: 'experience',     name: 'Experience',     icon: <Briefcase size={16} /> },
            { id: 'education',      name: 'Education',      icon: <GraduationCap size={16} /> },
            { id: 'skills',         name: 'Skills',         icon: <Award size={16} /> },
            { id: 'projects',       name: 'Projects',       icon: <FolderGit2 size={16} /> },
            { id: 'certifications', name: 'Certifications', icon: <Award size={16} /> },
            { id: 'publications',   name: 'Publications',   icon: <BookOpen size={16} /> },
            { id: 'languages',      name: 'Languages',      icon: <Globe size={16} /> },
            { id: 'volunteer',      name: 'Volunteer',      icon: <Heart size={16} /> },
            { id: 'awards',         name: 'Awards',         icon: <Trophy size={16} /> },
        ]},
        { label: 'AI Tools', items: [
            { id: 'jd-match',      name: 'JD Match',     icon: <Target size={16} /> },
            { id: 'cover-letter',  name: 'Cover Letter', icon: <Mail size={16} /> },
        ]},
        { label: 'Layout & Design', items: [
            { id: 'section-order', name: 'Order & Visibility', icon: <GripVertical size={16} /> },
            { id: 'templates',     name: 'Templates',          icon: <LayoutTemplate size={16}/> },
            { id: 'design',        name: 'Design',             icon: <Palette size={16}/> },
        ]},
    ];
    // Count filled entries so tabs show what the parser actually placed
    const sectionCount = (id: string): number | null => {
        const d: any = resumeData;
        if (Array.isArray(d[id])) return d[id].length;
        return null;
    };

    return (
        <CandidateLayout>
            <EnhancementModal isOpen={showEnhancementModal} versions={enhancementVersions} selected={selectedEnhancement} onSelect={setSelectedEnhancement} onApply={handleApplyEnhancement} onClose={() => setShowEnhancementModal(false)} originalText={originalText} />
            <PitchModal isOpen={showPitchModal} onClose={() => setShowPitchModal(false)} pitchText={pitchText} setPitchText={setPitchText} startRecording={startRecording} stopRecording={stopRecording} isRecording={isRecording} recordedVideoUrl={recordedVideoUrl} videoRef={videoRef} onVideoFileChange={handleVideoFileUpload} onUpload={handleUploadPitchVideo} loading={loading} videoBlob={videoBlob} />
            
            <div className="flex flex-col bg-transparent font-sans -m-4 md:-m-6 h-[calc(100vh-4rem)]">
                <header className="flex-shrink-0 bg-white/5 dark:bg-zinc-900/40 backdrop-blur-md border-b border-white/10 p-4">
                  <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                           <div><h1 className="text-2xl font-bold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">AI Resume Builder</h1><p className="text-xs text-gray-300">Craft your professional resume with AI assistance</p></div>
                      </div>
                      <div className="flex items-center gap-4">
                           <Button onClick={handleGeneratePitch} disabled={loading} size="sm" variant="outline"><Mic size={14} className="mr-1.5" />Elevator Pitch</Button>
                      </div>
                  </div>
                </header>

                <main className="flex flex-col lg:flex-row flex-1 min-h-0 overflow-y-auto lg:overflow-y-hidden">
                    <div className="flex flex-col lg:overflow-y-auto p-4 md:p-6 max-lg:!w-full" style={{ width: `${panelWidth}%` }}>
                        <div className="space-y-6">
                            <Card>
                                <CardHeader><CardTitle className="flex items-center gap-2"><Upload size={20} />Upload Resume</CardTitle></CardHeader>
                                <CardContent>
                                    {uploadedFileName ? (
                                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
                                            <div className="flex items-center gap-2 min-w-0">
                                                <CheckCircle2 size={16} className="text-green-400 flex-shrink-0" />
                                                <span className="text-sm text-zinc-200 truncate">{uploadedFileName}</span>
                                            </div>
                                            <div className="flex items-center gap-2 flex-shrink-0">
                                                <label htmlFor="reupload-file" className="cursor-pointer">
                                                    <Button as="span" size="sm" variant="outline" className="h-8 text-xs px-2"><Upload size={12} className="mr-1" />Replace</Button>
                                                </label>
                                                <Input id="reupload-file" type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={loading} className="hidden" />
                                                <Button size="sm" variant="destructive" className="h-8 text-xs px-2" onClick={handleClearResume}><FilePlus2 size={12} className="mr-1" />New</Button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Input type="file" accept=".pdf,.docx" onChange={handleFileUpload} disabled={loading} />
                                            <p className="text-xs text-zinc-500 mt-1.5">Upload an existing resume to auto-fill all sections, or fill manually below.</p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            {/* ── ATS Readiness Panel ── */}
                            {showAnalysis && resumeAnalysis && (
                                <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/20 overflow-hidden">
                                    {/* Header with large gauge */}
                                    <div className="flex items-center justify-between px-5 py-4 border-b border-indigo-500/20 bg-indigo-950/40 cursor-pointer select-none hover:bg-indigo-950/60 transition-colors"
                                        onClick={() => setAtsExpanded(v => !v)}
                                        title={atsExpanded ? 'Collapse details' : 'Expand details'}>
                                        <div className="flex items-center gap-4">
                                            <div className="relative w-20 h-20 shrink-0">
                                                <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                                                    <circle cx="40" cy="40" r="34" strokeWidth="7" fill="transparent" className="stroke-slate-700/80" />
                                                    <circle cx="40" cy="40" r="34" strokeWidth="7" fill="transparent"
                                                        strokeDasharray={2 * Math.PI * 34}
                                                        strokeDashoffset={2 * Math.PI * 34 * (1 - (resumeAnalysis.overallScore || 0) / 100)}
                                                        strokeLinecap="round"
                                                        className={resumeAnalysis.overallScore >= 80 ? 'stroke-emerald-400' : resumeAnalysis.overallScore >= 55 ? 'stroke-indigo-400' : 'stroke-rose-500'}
                                                    />
                                                </svg>
                                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                                    <span className={`text-2xl font-black leading-none ${resumeAnalysis.overallScore >= 80 ? 'text-emerald-400' : resumeAnalysis.overallScore >= 55 ? 'text-indigo-400' : 'text-rose-400'}`}>
                                                        {resumeAnalysis.overallScore}
                                                    </span>
                                                    <span className="text-[9px] text-zinc-400 mt-0.5">/ 100</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-base font-bold text-white">ATS Readiness</p>
                                                <p className="text-[11px] text-zinc-400 mt-0.5">
                                                    {resumeAnalysis.overallScore >= 90 ? 'Excellent — ready to apply!' :
                                                     resumeAnalysis.overallScore >= 70 ? 'Good — minor tweaks needed' :
                                                     resumeAnalysis.overallScore >= 50 ? 'Fair — follow the fixes below' :
                                                     'Needs work — complete the sections below'}
                                                </p>
                                                {resumeAnalysis.overallScore < 100 && (
                                                    <p className="text-[10px] text-indigo-300 mt-1 font-medium">
                                                        +{100 - resumeAnalysis.overallScore} pts to reach 100
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1 self-start">
                                            <span className="text-[10px] font-semibold text-indigo-300 flex items-center gap-1 px-2 py-1 rounded-lg border border-indigo-500/30">
                                                {atsExpanded ? <>Hide details <ArrowUp size={11} /></> : <>Path to 100% <ArrowDown size={11} /></>}
                                            </span>
                                            <button type="button" onClick={(e) => { e.stopPropagation(); setShowAnalysis(false); }} className="text-zinc-500 hover:text-zinc-300 p-1"><X size={16} /></button>
                                        </div>
                                    </div>

                                    {atsExpanded && (
                                    <div className="p-4 space-y-3">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-300">Path to 100%</p>

                                        {([
                                            { key: 'contact',    editorKey: 'personal',   weight: 15 },
                                            { key: 'summary',    editorKey: 'summary',    weight: 15 },
                                            { key: 'experience', editorKey: 'experience', weight: 30 },
                                            { key: 'education',  editorKey: 'education',  weight: 15 },
                                            { key: 'skills',     editorKey: 'skills',     weight: 20 },
                                            { key: 'projects',   editorKey: 'projects',   weight:  5 },
                                        ] as { key: string; editorKey: string; weight: number }[]).map(({ key, editorKey, weight }) => {
                                            const sec: any = (resumeAnalysis.sections || {})[key] || {};
                                            const score: number = sec.score ?? 0;
                                            const ptsAtStake = Math.round(weight * (100 - score) / 100);
                                            const done = score >= 100;
                                            return (
                                                <div key={key} className={`rounded-xl p-3 ${done ? 'bg-emerald-950/30 border border-emerald-500/20' : 'bg-white/[0.04] border border-white/[0.07]'}`}>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <div className="flex items-center gap-2">
                                                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${done ? 'bg-emerald-500/20 text-emerald-300' : ptsAtStake >= 10 ? 'bg-rose-500/20 text-rose-300' : 'bg-yellow-500/20 text-yellow-300'}`}>
                                                                {done ? '✓' : `+${ptsAtStake} pts`}
                                                            </span>
                                                            <span className="text-xs font-semibold text-white">{sec.label || key}</span>
                                                        </div>
                                                        {!done && (
                                                            <button
                                                                type="button"
                                                                onClick={() => setActiveSection(editorKey)}
                                                                className="text-[10px] font-bold text-indigo-300 hover:text-indigo-100 border border-indigo-500/40 hover:border-indigo-400 rounded px-2 py-0.5 transition-colors shrink-0"
                                                            >
                                                                Fix →
                                                            </button>
                                                        )}
                                                    </div>
                                                    <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
                                                        <div className="h-full rounded-full transition-all duration-700"
                                                            style={{ width: `${score}%`, background: score >= 80 ? '#34d399' : score >= 50 ? '#818cf8' : '#f87171' }}
                                                        />
                                                    </div>
                                                    <div className="flex justify-between mt-1">
                                                        <span className="text-[9px] text-zinc-500">{weight}% of score</span>
                                                        <span className={`text-[9px] font-bold ${score >= 80 ? 'text-emerald-400' : score >= 50 ? 'text-indigo-400' : 'text-rose-400'}`}>{score}%</span>
                                                    </div>
                                                    {(sec.issues || []).length > 0 && (
                                                        <div className="mt-2 space-y-1">
                                                            {(sec.issues as string[]).map((issue, i) => (
                                                                <p key={i} className="text-[10px] text-zinc-400 flex items-start gap-1.5">
                                                                    <span className="text-yellow-400 shrink-0">›</span>{issue}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}

                                        {(resumeAnalysis.strengths || []).length > 0 && (
                                            <div className="border-t border-white/5 pt-3 space-y-1.5">
                                                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 mb-2">What&apos;s working</p>
                                                {(resumeAnalysis.strengths as string[]).map((s, i) => (
                                                    <div key={i} className="flex items-start gap-2 text-[11px] text-zinc-300">
                                                        <span className="text-emerald-400 shrink-0 mt-0.5">✓</span>{s}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    )}
                                </div>
                            )}
                            <Card>
                                <CardContent className="p-4 space-y-3">
                                    {sectionGroups.map(group => (
                                        <div key={group.label}>
                                            <p className="text-[9px] font-bold font-mono uppercase tracking-[0.18em] text-zinc-500 mb-1.5">{group.label}</p>
                                            <div className="flex flex-wrap gap-2">
                                                {group.items.map(section => {
                                                    const count = sectionCount(section.id);
                                                    return (
                                                        <Button key={section.id} variant={activeSection === section.id ? "default" : "outline"} onClick={() => setActiveSection(section.id)} size="sm" className="flex items-center gap-2">
                                                            {section.icon} {section.name}
                                                            {count !== null && count > 0 && (
                                                                <span className="ml-0.5 px-1.5 py-0 rounded-full text-[9px] font-bold bg-white/15">{count}</span>
                                                            )}
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ))}
                                </CardContent>
                                <CardContent>
                                    {activeSection === 'personal' && <PersonalForm data={resumeData.personal} onChange={handlePersonalChange} onPicChange={handleProfilePicChange} onPicRemove={handleProfilePicRemove} picPreview={profilePic.preview} />}
                                    {activeSection === 'summary' && <SummaryForm value={resumeData.summary} onChange={(v: string) => { handleSummaryChange(v); if (summarySuggestions.length > 0) setSummarySuggestions([]); }} onEnhance={() => handleEnhance({ section: 'summary'})} loading={loading} suggestions={summarySuggestions} newBatchFrom={newBatchFrom} suggestionsLoading={suggestionsLoading} onGenerateMore={() => fetchSummarySuggestions(undefined, summarySuggestions.length > 0)} onApplySuggestion={(s: string) => { handleSummaryChange(s); setSummarySuggestions([]); setNewBatchFrom(0); toast.success("Summary applied!"); }} onDismissSuggestions={() => { setSummarySuggestions([]); setNewBatchFrom(0); }} />}
                                    {activeSection === 'experience' && <DynamicSection sectionKey="experience" data={resumeData.experience} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ jobTitle: '', company: '', dates: '', description: '<p></p>' }} fields={[{key: 'jobTitle', label: 'Job Title'}, {key: 'company', label: 'Company'}, {key: 'dates', label: 'Dates'}, {key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2}]} />}
                                    {activeSection === 'education' && <DynamicSection sectionKey="education" data={resumeData.education} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ degree: '', institution: '', graduationYear: '', gpa: '', achievements: '<p></p>' }} fields={[{key: 'degree', label: 'Degree'}, {key: 'institution', label: 'Institution'}, {key: 'graduationYear', label: 'Graduation Year'}, {key: 'gpa', label: 'GPA (Optional)'}, {key: 'achievements', label: 'Achievements & Coursework', type: 'textarea', enhance: true}]} />}
                                    {activeSection === 'skills' && <DynamicSection sectionKey="skills" data={resumeData.skills} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ category: '', skills_list: '' }} fields={[{key: 'category', label: 'Category'}, {key: 'skills_list', label: 'Skills', type: 'skill_tags', colSpan: 2}]} />}
                                    {activeSection === 'projects' && <DynamicSection sectionKey="projects" data={resumeData.projects} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ title: '', date: '', description: '<p></p>' }} fields={[{key: 'title', label: 'Project Title'}, {key: 'date', label: 'Date'}, {key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2}]} />}
                                    {activeSection === 'publications' && <DynamicSection sectionKey="publications" data={resumeData.publications} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ title: '', authors: '', journal: '', date: '', link: '' }} fields={[{key: 'title', label: 'Publication Title'}, {key: 'authors', label: 'Authors'}, {key: 'journal', label: 'Journal or Conference'}, {key: 'date', label: 'Publication Date'}, {key: 'link', label: 'Link (Optional)'}]} />}
                                    {activeSection === 'certifications' && <DynamicSection sectionKey="certifications" data={resumeData.certifications} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ name: '', issuer: '', date: '' }} fields={[{key: 'name', label: 'Certification Name'}, {key: 'issuer', label: 'Issuing Organization'}, {key: 'date', label: 'Date Received'}]} />}
                                    {activeSection === 'languages' && <LanguagesForm data={resumeData.languages} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} />}
                                    {activeSection === 'volunteer' && <DynamicSection sectionKey="volunteer" data={resumeData.volunteer} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} onEnhance={handleEnhance} loading={loading} addPayload={{ role: '', organization: '', dates: '', description: '<p></p>' }} fields={[{key: 'role', label: 'Role / Title'}, {key: 'organization', label: 'Organization'}, {key: 'dates', label: 'Dates'}, {key: 'description', label: 'Description', type: 'textarea', enhance: true, colSpan: 2}]} />}
                                    {activeSection === 'awards' && <DynamicSection sectionKey="awards" data={resumeData.awards} onChange={handleDynamicChange} onAdd={addDynamicEntry} onRemove={removeDynamicEntry} loading={loading} addPayload={{ title: '', organization: '', date: '', description: '<p></p>' }} fields={[{key: 'title', label: 'Award Title'}, {key: 'organization', label: 'Awarding Organization'}, {key: 'date', label: 'Date'}, {key: 'description', label: 'Description (optional)', type: 'textarea', colSpan: 2}]} />}
                                    {activeSection === 'jd-match' && <JDMatchPanel resumeData={resumeData} apiBase={API_BASE_URL} getToken={getToken} />}
                                    {activeSection === 'cover-letter' && <CoverLetterForm resumeData={resumeData} apiBase={API_BASE_URL} getToken={getToken} />}
                                    {activeSection === 'section-order' && (
                                        <div className="space-y-2">
                                            <p className="text-xs text-zinc-400 mb-3">Drag to reorder sections. Click the eye to hide from preview (data is preserved).</p>
                                            {sectionOrder.map((secId, idx) => {
                                                const secMeta = sectionGroups.flatMap(g => g.items).find(s => s.id === secId);
                                                const hidden = hiddenSections.has(secId);
                                                return (
                                                    <div key={secId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${hidden ? 'border-white/5 bg-white/[0.02] opacity-50' : 'border-white/10 bg-white/[0.04]'}`}>
                                                        <GripVertical size={14} className="text-zinc-600 flex-shrink-0" />
                                                        <span className="flex-1 text-sm text-zinc-300 flex items-center gap-2">{secMeta?.icon}{secMeta?.name || secId}</span>
                                                        <button onClick={() => moveSectionUp(secId)} disabled={idx === 0} className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"><ArrowUp size={12} /></button>
                                                        <button onClick={() => moveSectionDown(secId)} disabled={idx === sectionOrder.length - 1} className="p-1 text-zinc-500 hover:text-white disabled:opacity-20 transition-colors"><ArrowDown size={12} /></button>
                                                        <button onClick={() => toggleSectionVisibility(secId)} className={`p-1 transition-colors ${hidden ? 'text-zinc-600' : 'text-indigo-400'}`}>{hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {activeSection === 'templates' && <TemplatePickerForm selected={selectedTemplate} onSelect={setSelectedTemplate} />}
                                    {activeSection === 'design' && <DesignForm options={styleOptions} onChange={handleStyleChange} />}
                                </CardContent>
                            </Card>
                        </div>
                    </div>
                    
                    <div className="hidden lg:block flex-shrink-0 w-1.5 cursor-col-resize bg-white/10 hover:bg-[var(--cc-accent)]/60 transition-colors rounded-full my-4" onMouseDown={handleMouseDown}></div>

                    <div className="flex-1 flex flex-col lg:overflow-y-auto p-4 md:p-6 min-w-0">
                       <Card className="flex-1 flex flex-col">
                           <CardHeader><CardTitle className="flex items-center gap-2"><Eye size={20} />Resume Preview</CardTitle></CardHeader>
                           <CardContent className="flex-1 overflow-y-auto">
                              {renderResumePreview()}
                           </CardContent>
                       </Card>
                       <div className="space-y-4 mt-6 flex-shrink-0">
                           <div className="grid grid-cols-2 gap-3">
                               <Button className="w-full bg-zinc-700 hover:bg-zinc-600 text-white border border-zinc-500" onClick={handleSaveDraft} disabled={loading}><Save size={15} className="mr-2" />Save Draft</Button>
                               <Button className="w-full bg-purple-600 hover:bg-purple-700 text-white" onClick={handleSaveResume} disabled={loading}><Upload size={15} className="mr-2" />Save & Publish</Button>
                               <Button className="w-full bg-green-600 hover:bg-green-700" onClick={() => handleDownload('PDF')} disabled={loading}><Download size={15} className="mr-2" />Download PDF</Button>
                               <Button variant="outline" className="w-full" onClick={() => handleDownload('DOCX')} disabled={loading}><Download size={15} className="mr-2" />Download DOCX</Button>
                           </div>

                           {/* ── Upload Resume File ───────────────────────────── */}
                           <div className="pt-3 border-t border-white/10">
                               <input
                                   ref={fileUploadRef}
                                   type="file"
                                   accept=".pdf,.doc,.docx"
                                   className="hidden"
                                   onChange={handleResumeFileUpload}
                               />
                               <Button
                                   className="w-full bg-zinc-800 hover:bg-zinc-700 border border-white/10 text-white text-xs"
                                   onClick={() => fileUploadRef.current?.click()}
                                   disabled={uploadingFile}
                               >
                                   {uploadingFile
                                       ? <><Loader2 size={14} className="mr-2 animate-spin" />Uploading & Parsing…</>
                                       : <><UploadCloud size={14} className="mr-2" />Attach a resume file for applications</>
                                   }
                               </Button>
                               {uploadedFiles.length > 0 && (
                                   <div className="mt-2 space-y-1">
                                       <p className="text-[10px] text-zinc-500 uppercase tracking-wider font-semibold">Files used when applying to jobs</p>
                                       {uploadedFiles.map((f, i) => (
                                           <div key={i} className="flex items-center gap-2 text-[11px] text-zinc-400 bg-white/5 rounded-lg px-2 py-1.5">
                                               <FileText size={10} className="text-zinc-500 flex-shrink-0" />
                                               <span className="truncate flex-1">{f.name}</span>
                                               <a href={f.url} target="_blank" rel="noreferrer" className="text-indigo-400 hover:text-indigo-300 flex-shrink-0">↗</a>
                                           </div>
                                       ))}
                                   </div>
                               )}
                           </div>

                           {/* ── Saved Versions ───────────────────────────────── */}
                           <div className="space-y-2 pt-3 border-t border-white/10">
                               <button
                                   onClick={() => setShowVersionPanel(v => !v)}
                                   className="w-full flex items-center justify-between text-xs text-zinc-400 hover:text-white transition-colors"
                               >
                                   <span className="flex items-center gap-1.5 font-semibold">
                                       <Star size={12} /> Saved Versions
                                       {savedVersions.length > 0 && (
                                           <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[10px] px-1.5 py-0.5 rounded-full">
                                               {savedVersions.length}
                                           </span>
                                       )}
                                   </span>
                                   {showVersionPanel ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                               </button>

                               {showVersionPanel && (
                                   <div className="space-y-2">
                                       {/* Save current as named version */}
                                       <div className="flex gap-2">
                                           <input
                                               value={versionNameInput}
                                               onChange={e => setVersionNameInput(e.target.value)}
                                               onKeyDown={e => e.key === 'Enter' && handleSaveAsVersion()}
                                               placeholder="Version name (e.g. SWE Resume)…"
                                               className="flex-1 bg-zinc-900/60 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-indigo-500/40"
                                           />
                                           <Button
                                               size="sm"
                                               onClick={handleSaveAsVersion}
                                               disabled={savingVersion}
                                               className="text-xs px-3 bg-indigo-600 hover:bg-indigo-500 text-white whitespace-nowrap"
                                           >
                                               {savingVersion ? '…' : 'Save'}
                                           </Button>
                                       </div>

                                       {/* Versions list */}
                                       {savedVersions.length === 0 ? (
                                           <p className="text-[11px] text-zinc-600 text-center py-2">No saved versions yet</p>
                                       ) : (
                                           <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                                               {savedVersions.map(v => (
                                                   <div key={v.id} className="flex items-center gap-2 p-2 bg-white/5 rounded-lg border border-white/5">
                                                       <div className="flex-1 min-w-0">
                                                           <p className="text-xs font-semibold text-white truncate">{v.name}</p>
                                                           <p className="text-[10px] text-zinc-500">{new Date(v.savedAt).toLocaleDateString()}</p>
                                                       </div>
                                                       <button
                                                           onClick={() => handleLoadVersion(v)}
                                                           className="flex items-center gap-1 text-[10px] text-indigo-400 hover:text-indigo-300 border border-indigo-500/20 px-2 py-1 rounded transition-colors whitespace-nowrap"
                                                       >
                                                           <FolderOpen size={10} /> Load
                                                       </button>
                                                       <button
                                                           onClick={() => handleDeleteVersion(v.id)}
                                                           className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                                                       >
                                                           <Trash2 size={10} />
                                                       </button>
                                                   </div>
                                               ))}
                                           </div>
                                       )}
                                   </div>
                               )}
                           </div>
                       </div>
                    </div>
                </main>
            </div>
        </CandidateLayout>
    );
}