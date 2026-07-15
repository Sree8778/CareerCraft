// Job type used across candidate job pages.
// All job data is fetched from Firebase via the backend API — no local mock data.

export type Job = {
  id: string;
  title: string;
  company: string;
  location: string;
  salary: string;
  description: string;
  requirements: string[];
  benefits: string[];
  postedDate: string;
  employmentType: string;
  emoji: string;
};
