export const INITIAL_FILTERS = {
  search: "",
};

export const INITIAL_MEMBER_FILTERS = {
  search: "",
  role: "all",
  department: "all",
  status: "all",
};

export const INITIAL_PROJECT_FILTERS = {
  search: "",
  status: "all",
  department: "all",
};

export const SOCIAL_MEDIA_OPTIONS = [
  {
    value: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/your-center",
  },
  {
    value: "instagram",
    label: "Instagram",
    placeholder: "https://instagram.com/your-center",
  },
  {
    value: "x",
    label: "X (Twitter)",
    placeholder: "https://x.com/your-center",
  },
  {
    value: "linkedin",
    label: "LinkedIn",
    placeholder: "https://linkedin.com/company/your-center",
  },
  {
    value: "youtube",
    label: "YouTube",
    placeholder: "https://youtube.com/@your-center",
  },
  {
    value: "website",
    label: "Website",
    placeholder: "https://your-center.edu",
  },
];

export const EMPTY_EDITING = {
  id: null,
  name: "",
  code: "",
  description: "",
  socialMediaLink: "",
  socialMediaPlatform: "facebook",
  centerChiefId: "",
  agendaInput: "",
  researchAgendas: [],
};

export const PAGE_SIZE = 10;
export const DIRECTORY_SKELETON_COUNT = 6;
export const MEMBER_PAGE_SIZE = 8;
export const PROJECT_PAGE_SIZE = 6;
