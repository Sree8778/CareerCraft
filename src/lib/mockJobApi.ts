// src/lib/mockJobApi.ts
import { nanoid } from 'nanoid';

export type Job = {
  id: string; // Changed to string for nanoid
  title: string;
  company: string; // Assuming company name is fixed or fetched
  location: string;
  salary: string;
  description: string;
  requirements: string[];
  benefits: string[];
  postedDate: string;
  employmentType: string;
  emoji: string; // For display purposes
};

// This array will act as our in-memory database for jobs
let jobs: Job[] = [
  {
    id: 'job-1',
    title: 'Frontend Developer',
    company: 'InnovateCorp',
    location: 'New York, NY',
    salary: '$100K - $130K',
    description: 'We are looking for a skilled Frontend Developer to join our team...',
    requirements: ['React', 'TypeScript', 'HTML/CSS'],
    benefits: ['Health', 'Dental', 'Paid Time Off'],
    postedDate: '2025-07-01',
    employmentType: 'Full-time',
    emoji: '💻',
  },
  {
    id: 'job-2',
    title: 'Backend Engineer',
    company: 'DataSolutions',
    location: 'Remote',
    salary: '$110K - $140K',
    description: 'Build robust backend services for our data platform...',
    requirements: ['Node.js', 'Python', 'AWS', 'Databases'],
    benefits: ['Remote work', 'Flexible hours', 'Stock options'],
    postedDate: '2025-06-25',
    employmentType: 'Full-time',
    emoji: '⚙️',
  },
  {
    id: 'job-3',
    title: 'UX/UI Designer',
    company: 'CreativeFlow',
    location: 'Austin, TX',
    salary: '$90K - $120K',
    description: 'Design intuitive and engaging user experiences...',
    requirements: ['Figma', 'User Research', 'Prototyping'],
    benefits: ['Design budget', 'Wellness programs', 'Paid conferences'],
    postedDate: '2025-07-10',
    employmentType: 'Full-time',
    emoji: '🎨',
  },
];

export const mockJobApi = {
  // Get all jobs
  getJobs: async (): Promise<Job[]> => {
    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 300));
    return jobs;
  },

  // Get a single job by ID
  getJobById: async (id: string): Promise<Job | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    return jobs.find((job) => job.id === id);
  },

  // Add a new job
  addJob: async (newJobData: Omit<Job, 'id' | 'postedDate' | 'emoji' | 'benefits' | 'requirements' | 'company'> & { companyName: string; salaryRange: [number, number]; requirements?: string[]; benefits?: string[] }): Promise<Job> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    // Simulate adding a few default requirements/benefits and an emoji
    const addedJob: Job = {
      id: nanoid(), // Generate unique ID
      postedDate: new Date().toISOString().split('T')[0], // Current date
      company: newJobData.companyName, // Use company name from form
      requirements: newJobData.requirements || ['Strong communication skills', 'Problem-solving abilities', 'Team player'], // Mock requirements or use provided
      benefits: newJobData.benefits || ['Competitive salary', 'Health benefits', 'Paid time off'], // Mock benefits or use provided
      emoji: '📄', // Default emoji for new jobs
      title: newJobData.title,
      location: newJobData.location,
      description: newJobData.description,
      employmentType: newJobData.employmentType,
      salary: `$${newJobData.salaryRange[0] / 1000}K - $${newJobData.salaryRange[1] / 1000}K`, // Format salary
    };
    jobs.push(addedJob);
    return addedJob;
  },

  // Update a job (simplified, not fully implemented for this task)
  updateJob: async (id: string, updatedFields: Partial<Job>): Promise<Job | undefined> => {
    await new Promise((resolve) => setTimeout(resolve, 300));
    const index = jobs.findIndex((job) => job.id === id);
    if (index > -1) {
      jobs[index] = { ...jobs[index], ...updatedFields };
      return jobs[index];
    }
    return undefined;
  },
};