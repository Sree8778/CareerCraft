type ResumeEntry = object;
type LatexPersonalInfo = {
    name?: unknown;
    email?: unknown;
    phone?: unknown;
    location?: unknown;
    linkedin?: unknown;
    website?: unknown;
    github?: unknown;
};

export type LatexResumeData = {
    personal?: LatexPersonalInfo;
    summary?: string;
    experience?: ResumeEntry[];
    education?: ResumeEntry[];
    skills?: ResumeEntry[];
    projects?: ResumeEntry[];
    researchProjects?: ResumeEntry[];
    certifications?: ResumeEntry[];
    publications?: ResumeEntry[];
    languages?: ResumeEntry[];
    volunteer?: ResumeEntry[];
    awards?: ResumeEntry[];
};

export type LatexResumeOptions = {
    sectionOrder?: string[];
    hiddenSections?: Iterable<string>;
};

const DEFAULT_SECTION_ORDER = ['summary', 'experience', 'education', 'skills', 'projects', 'certifications'];

const decodeHtml = (value: string) => value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");

const toPlainText = (value: unknown): string => {
    if (typeof value !== 'string') return '';
    return decodeHtml(value)
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*\/\s*(p|div|li|ul|ol)\s*>/gi, '\n')
        .replace(/<[^>]*>/g, '')
        .replace(/\r/g, '')
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .trim();
};

const LATEX_ESCAPES: Record<string, string> = {
    '\\': '\\textbackslash{}',
    '{': '\\{',
    '}': '\\}',
    '$': '\\$',
    '&': '\\&',
    '#': '\\#',
    '_': '\\_',
    '%': '\\%',
    '~': '\\textasciitilde{}',
    '^': '\\textasciicircum{}',
};

const escapeLatex = (value: unknown): string => toPlainText(value)
    .replace(/[\\{}$&#_%~^]/g, char => LATEX_ESCAPES[char]);

const escapeLatexUrl = (value: unknown): string => String(value || '')
    .trim()
    .replace(/\\/g, '%5C')
    .replace(/([{} ])/g, '\\$1');

const asEntries = (value: unknown): ResumeEntry[] => Array.isArray(value) ? value as ResumeEntry[] : [];

const field = (entry: ResumeEntry, ...keys: string[]) => {
    const values = entry as Record<string, unknown>;
    for (const key of keys) {
        const value = values[key];
        if (typeof value === 'string' && toPlainText(value)) return value;
    }
    return '';
};

const bulletLines = (value: unknown): string[] => {
    const plain = toPlainText(value);
    if (!plain) return [];
    return plain
        .split('\n')
        .map(line => line.trim().replace(/^[-*•]\s*/, ''))
        .filter(Boolean);
};

const resumeItems = (value: unknown): string => bulletLines(value)
    .map(line => `      \\resumeItem{${escapeLatex(line)}}`)
    .join('\n');

const section = (title: string, content: string): string => content.trim()
    ? `\\section{${title}}\n${content.trim()}\n\\vspace{-10pt}`
    : '';

const link = (url: unknown, display: string) => {
    const raw = String(url || '').trim();
    if (!raw) return '';
    const href = /^(https?:\/\/|mailto:)/i.test(raw) ? raw : `https://${raw}`;
    return `\\href{${escapeLatexUrl(href)}}{\\underline{${escapeLatex(display)}}}`;
};

/**
 * Produces a portable, compile-ready one-page resume source in the same
 * conventional LaTeX format used by AIApply's export flow. The source is kept
 * entirely client-side, so it works with CareerCraft's existing parser and
 * document services and does not expose API keys.
 */
export const buildLatexResumeSource = (resumeData: LatexResumeData, options: LatexResumeOptions = {}): string => {
    const personal = resumeData.personal || {};
    const name = escapeLatex(personal.name || 'Your Name');
    const email = toPlainText(personal.email);
    const phone = toPlainText(personal.phone);
    const location = toPlainText(personal.location);
    const contacts = [
        email && `\\href{mailto:${escapeLatexUrl(email)}}{\\underline{${escapeLatex(email)}}}`,
        phone && escapeLatex(phone),
        location && escapeLatex(location),
        personal.linkedin && link(personal.linkedin, 'LinkedIn'),
        personal.github && link(personal.github, 'GitHub'),
        personal.website && link(personal.website, 'Portfolio'),
    ].filter(Boolean).join(' $|$ ');

    const hiddenSections = new Set(options.hiddenSections || []);
    const requestedOrder = options.sectionOrder?.length ? options.sectionOrder : DEFAULT_SECTION_ORDER;
    const sectionOrder = requestedOrder.filter(id => !hiddenSections.has(id));
    const sections: string[] = [];

    for (const id of sectionOrder) {
        if (id === 'summary') {
            const summary = escapeLatex(resumeData.summary);
            if (summary) {
                sections.push(section('Professional Summary', `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{${summary}}}\n\\end{itemize}`));
            }
        }

        if (id === 'experience') {
            const entries = asEntries(resumeData.experience);
            const content = entries.map(entry => {
                const bullets = resumeItems(field(entry, 'description', 'achievements'));
                return `  \\resumeSubheading\n    {${escapeLatex(field(entry, 'jobTitle', 'position', 'role') || 'Position')}}{${escapeLatex(field(entry, 'dates', 'duration'))}}\n    {${escapeLatex(field(entry, 'company', 'organization'))}}{}\n    \\resumeItemListStart${bullets ? `\n${bullets}\n` : '\n'}    \\resumeItemListEnd`;
            }).join('\n');
            if (content) sections.push(section('Experience', `\\resumeSubHeadingListStart\n${content}\n\\resumeSubHeadingListEnd`));
        }

        if (id === 'education') {
            const content = asEntries(resumeData.education).map(entry => `  \\resumeSubheading\n    {${escapeLatex(field(entry, 'institution', 'school') || 'Institution')}}{${escapeLatex(field(entry, 'graduationYear', 'dates', 'duration'))}}\n    {${escapeLatex(field(entry, 'degree', 'fieldOfStudy') || 'Degree')}}{${escapeLatex(field(entry, 'gpa') ? `GPA: ${field(entry, 'gpa')}` : '')}}`).join('\n');
            if (content) sections.push(section('Education', `\\resumeSubHeadingListStart\n${content}\n\\resumeSubHeadingListEnd`));
        }

        if (id === 'skills') {
            const skillGroups = asEntries(resumeData.skills).map(entry => {
                const category = escapeLatex(field(entry, 'category') || 'Skills');
                const skills = escapeLatex(field(entry, 'skills_list', 'skills'));
                return skills ? `\\textbf{${category}}{: ${skills}}` : '';
            }).filter(Boolean).join(' \\quad ');
            if (skillGroups) sections.push(section('Technical Skills', `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{${skillGroups}}}\n\\end{itemize}`));
        }

        if (id === 'projects') {
            const content = asEntries(resumeData.projects).map(entry => {
                const bullets = resumeItems(field(entry, 'description', 'achievements'));
                return `  \\resumeProjectHeading\n    {\\textbf{${escapeLatex(field(entry, 'title', 'name') || 'Project')}}}{${escapeLatex(field(entry, 'date', 'dates'))}}\n    \\resumeItemListStart${bullets ? `\n${bullets}\n` : '\n'}    \\resumeItemListEnd`;
            }).join('\n');
            if (content) sections.push(section('Projects', `\\resumeSubHeadingListStart\n${content}\n\\resumeSubHeadingListEnd`));
        }

        if (id === 'researchProjects') {
            const content = asEntries(resumeData.researchProjects).map(entry => {
                const bullets = resumeItems(field(entry, 'description', 'achievements'));
                return `  \\resumeProjectHeading\n    {\\textbf{${escapeLatex(field(entry, 'title', 'name') || 'Research Project')}}}{${escapeLatex(field(entry, 'date', 'dates'))}}\n    \\resumeItemListStart${bullets ? `\n${bullets}\n` : '\n'}    \\resumeItemListEnd`;
            }).join('\n');
            if (content) sections.push(section('Research Projects', `\\resumeSubHeadingListStart\n${content}\n\\resumeSubHeadingListEnd`));
        }

        if (id === 'certifications') {
            const content = asEntries(resumeData.certifications).map(entry => {
                const title = escapeLatex(field(entry, 'name'));
                const issuer = escapeLatex(field(entry, 'issuer'));
                const date = escapeLatex(field(entry, 'date'));
                return title ? `  \\resumeItem{\\textbf{${title}}${issuer ? ` — ${issuer}` : ''}${date ? ` (${date})` : ''}}` : '';
            }).filter(Boolean).join('\n');
            if (content) sections.push(section('Certifications', `\\begin{itemize}[leftmargin=0.15in]\n${content}\n\\end{itemize}`));
        }

        if (id === 'publications') {
            const content = asEntries(resumeData.publications).map(entry => {
                const title = escapeLatex(field(entry, 'title'));
                const authors = escapeLatex(field(entry, 'authors'));
                const journal = escapeLatex(field(entry, 'journal'));
                const date = escapeLatex(field(entry, 'date'));
                return title ? `  \\resumeItem{\\textbf{${title}}${authors ? ` — ${authors}` : ''}${journal ? `, ${journal}` : ''}${date ? ` (${date})` : ''}}` : '';
            }).filter(Boolean).join('\n');
            if (content) sections.push(section('Publications', `\\begin{itemize}[leftmargin=0.15in]\n${content}\n\\end{itemize}`));
        }

        if (id === 'languages') {
            const content = asEntries(resumeData.languages).map(entry => {
                const language = escapeLatex(field(entry, 'language'));
                const proficiency = escapeLatex(field(entry, 'proficiency'));
                return language ? `${language}${proficiency ? ` (${proficiency})` : ''}` : '';
            }).filter(Boolean).join(' $\\cdot$ ');
            if (content) sections.push(section('Languages', `\\begin{itemize}[leftmargin=0.15in, label={}]\n  \\small{\\item{${content}}}\n\\end{itemize}`));
        }
    }

    return `\\documentclass[letterpaper,10pt]{article}
\\usepackage[utf8]{inputenc}
\\usepackage[empty]{fullpage}
\\usepackage{titlesec}
\\usepackage{enumitem}
\\usepackage[hidelinks]{hyperref}
\\usepackage{fancyhdr}
\\usepackage[english]{babel}
\\usepackage{tabularx}

\\pagestyle{fancy}
\\fancyhf{}
\\renewcommand{\\headrulewidth}{0pt}
\\renewcommand{\\footrulewidth}{0pt}
\\addtolength{\\oddsidemargin}{-0.5in}
\\addtolength{\\evensidemargin}{-0.5in}
\\addtolength{\\textwidth}{1.0in}
\\addtolength{\\topmargin}{-.55in}
\\addtolength{\\textheight}{1.1in}
\\urlstyle{same}
\\raggedbottom
\\raggedright
\\setlength{\\tabcolsep}{0in}
\\titleformat{\\section}{\\vspace{-4pt}\\scshape\\raggedright\\large\\bfseries}{}{0em}{}[\\titlerule \\vspace{-5pt}]

\\newcommand{\\resumeItem}[1]{\\item\\small{#1 \\vspace{-2pt}}}
\\newcommand{\\resumeSubheading}[4]{\\vspace{-2pt}\\item\\begin{tabular*}{0.97\\textwidth}[t]{l@{\\extracolsep{\\fill}}r}\\textbf{#1} & \\textbf{\\small #2} \\\\ \\textit{\\small#3} & \\textit{\\small #4} \\\\ \\end{tabular*}\\vspace{-7pt}}
\\newcommand{\\resumeProjectHeading}[2]{\\item\\begin{tabular*}{0.97\\textwidth}{l@{\\extracolsep{\\fill}}r}\\small#1 & \\textbf{\\small #2}\\\\\\end{tabular*}\\vspace{-7pt}}
\\newcommand{\\resumeSubHeadingListStart}{\\begin{itemize}[leftmargin=0.15in, label={}]}
\\newcommand{\\resumeSubHeadingListEnd}{\\end{itemize}}
\\newcommand{\\resumeItemListStart}{\\begin{itemize}}
\\newcommand{\\resumeItemListEnd}{\\end{itemize}\\vspace{-5pt}}

\\begin{document}
\\begin{center}
  {\\textbf{\\Huge \\scshape ${name}}} \\\\ \\vspace{1pt}
  \\small ${contacts}
\\end{center}

${sections.filter(Boolean).join('\n\n')}

\\end{document}
`;
};
