import { TicketPriority, TicketStatus } from "@prisma/client";

// Safely format date with fallback
export const safeFormatDate = (dateString: string | null | undefined, language: string = 'en'): string => {
  if (!dateString) return language === 'ar' ? "u062au0627u0631u064au062e u063au064au0631 u0645u0639u0631u0648u0641" : "Unknown date";
  try {
    const date = new Date(dateString);
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return language === 'ar' ? "u062au0627u0631u064au062e u063au064au0631 u0635u0627u0644u062d" : "Invalid date";
    }
    
    // Use Intl.DateTimeFormat for more reliable formatting with language support
    return new Intl.DateTimeFormat(language === 'ar' ? 'ar-SA' : 'en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  } catch (error) {
    console.error("Date formatting error:", error);
    return language === 'ar' ? "u062eu0637u0623 u0641u064a u062au0646u0633u064au0642 u0627u0644u062au0627u0631u064au062e" : "Date format error";
  }
};

// Get priority color class
export const getPriorityColor = (priority: TicketPriority) => {
  switch (priority) {
    case TicketPriority.LOW:
      return "bg-blue-100 text-blue-800 border-blue-200";
    case TicketPriority.MEDIUM:
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case TicketPriority.HIGH:
      return "bg-orange-100 text-orange-800 border-orange-200";
    case TicketPriority.CRITICAL:
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
};

// Get status color class
export const getStatusColor = (status: TicketStatus) => {
  switch (status) {
    case TicketStatus.OPEN:
      return "bg-red-50 text-red-700 border-red-200";
    case TicketStatus.IN_PROGRESS:
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case TicketStatus.RESOLVED:
      return "bg-green-50 text-green-700 border-green-200";
    case TicketStatus.CLOSED:
      return "bg-gray-50 text-gray-700 border-gray-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
};

// Get priority border color
export const getPriorityBorderColor = (priority: TicketPriority) => {
  switch (priority) {
    case TicketPriority.CRITICAL:
      return 'rgb(239, 68, 68)';
    case TicketPriority.HIGH:
      return 'rgb(249, 115, 22)';
    case TicketPriority.MEDIUM:
      return 'rgb(234, 179, 8)';
    case TicketPriority.LOW:
      return 'rgb(59, 130, 246)';
    default:
      return 'rgb(156, 163, 175)';
  }
};

// Sort tickets based on selected sort order
export const sortTickets = (tickets: any[], sortOrder: "newest" | "oldest" | "priority") => {
  return [...tickets].sort((a, b) => {
    if (sortOrder === "newest") {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    } else if (sortOrder === "oldest") {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    } else if (sortOrder === "priority") {
      // Sort by priority (CRITICAL > HIGH > MEDIUM > LOW)
      const priorityOrder = {
        [TicketPriority.CRITICAL]: 0,
        [TicketPriority.HIGH]: 1,
        [TicketPriority.MEDIUM]: 2,
        [TicketPriority.LOW]: 3,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return 0;
  });
};

// Filter tickets based on active tab and search query
export const filterTickets = (tickets: any[], activeTab: string, searchQuery: string) => {
  return tickets.filter((ticket) => {
    // First filter by tab
    const matchesTab = 
      activeTab === "all" ? true :
      activeTab === "open" ? ticket.status === TicketStatus.OPEN :
      activeTab === "in-progress" ? ticket.status === TicketStatus.IN_PROGRESS :
      activeTab === "resolved" ? ticket.status === TicketStatus.RESOLVED :
      true;
    
    // Then filter by search query if one exists
    if (!searchQuery.trim()) return matchesTab;
    
    const query = searchQuery.toLowerCase();
    return matchesTab && (
      ticket.title.toLowerCase().includes(query) ||
      ticket.description.toLowerCase().includes(query) ||
      (ticket.displayId && ticket.displayId.toLowerCase().includes(query)) ||
      (ticket.asset && ticket.asset.name.toLowerCase().includes(query))
    );
  });
};