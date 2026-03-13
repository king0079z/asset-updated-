import React, { useEffect, useState } from "react";
import { useTranslation } from "@/contexts/TranslationContext";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, Clock, Calendar, ArrowRight, Tag, LayoutList } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar } from "@/components/ui/avatar";
import { AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  dueDate: string;
  priority: "low" | "medium" | "high";
  assignedToId: string;
}

interface Ticket {
  id: string;
  title: string;
  description: string;
  status: TicketStatus;
  priority: "low" | "medium" | "high";
  assignedToId: string;
  displayId: string;
}

interface AssignedItemsListProps {
  onCountChange?: () => void;
}

export function AssignedItemsList({ onCountChange }: AssignedItemsListProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      fetchAssignedItems();
    }
  }, [user]);

  const fetchAssignedItems = async () => {
    setLoading(true);
    try {
      // Fetch assigned tasks
      const tasksResponse = await fetch("/api/planner/assigned");
      if (tasksResponse.ok) {
        const tasksData = await tasksResponse.json();
        setTasks(tasksData);
        console.log("Fetched assigned tasks:", tasksData);
      } else {
        console.error("Failed to fetch assigned tasks:", await tasksResponse.text());
      }

      // Fetch assigned tickets
      const ticketsResponse = await fetch("/api/tickets/assigned");
      if (ticketsResponse.ok) {
        const ticketsData = await ticketsResponse.json();
        setTickets(ticketsData);
        console.log("Fetched assigned tickets:", ticketsData);
      } else {
        console.error("Failed to fetch assigned tickets:", await ticketsResponse.text());
      }
    } catch (error) {
      console.error("Error fetching assigned items:", error);
      toast({
        title: t("error"),
        description: t("failed_to_load_assigned_items"),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateTaskStatus = async (taskId: string, newStatus: TaskStatus) => {
    setUpdatingItemId(taskId);
    try {
      const response = await fetch(`/api/planner/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        // Update local state
        setTasks((prevTasks) =>
          prevTasks.map((task) =>
            task.id === taskId ? { ...task, status: newStatus } : task
          )
        );
        
        // If task is completed, notify parent to update count
        if (newStatus === "completed" && onCountChange) {
          onCountChange();
        }
        
        toast({
          title: t("success"),
          description: t("task_status_updated"),
        });
      } else {
        toast({
          title: t("error"),
          description: t("failed_to_update_task_status"),
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating task status:", error);
      toast({
        title: t("error"),
        description: t("failed_to_update_task_status"),
        variant: "destructive",
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: TicketStatus) => {
    setUpdatingItemId(ticketId);
    try {
      // Generate an appropriate comment based on the action
      let comment = "";
      if (newStatus === "in_progress") {
        comment = "Staff started working on this ticket";
      } else if (newStatus === "resolved") {
        comment = "Staff resolved this ticket";
      }
      
      // Convert status to uppercase to match the database enum
      const dbStatus = newStatus.toUpperCase();
      
      console.log(`Updating ticket ${ticketId} status to ${dbStatus} with comment: ${comment}`);
      
      const response = await fetch(`/api/tickets/${ticketId}`, {
        method: "PUT", // Use PUT instead of PATCH for full update
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache, no-store, must-revalidate",
          "Pragma": "no-cache",
          "Expires": "0"
        },
        body: JSON.stringify({ 
          status: dbStatus,
          comment: comment // Include a comment to ensure it's logged in history
        }),
      });

      if (response.ok) {
        // Get the updated ticket from the response
        const updatedTicket = await response.json();
        console.log(`Ticket update successful. New status: ${updatedTicket.status}`);
        
        if (newStatus === "resolved") {
          // If ticket is resolved, remove it from the list immediately
          setTickets((prevTickets) => 
            prevTickets.filter((ticket) => ticket.id !== ticketId)
          );
          
          // Notify parent to update count
          if (onCountChange) {
            onCountChange();
          }
          
          // Refresh the assigned items list to ensure it's up to date
          setTimeout(() => {
            fetchAssignedItems();
          }, 500);
          
          toast({
            title: t("success"),
            description: "You've successfully resolved this ticket",
          });
        } else {
          // For other status changes, just update the ticket in the list
          setTickets((prevTickets) =>
            prevTickets.map((ticket) =>
              ticket.id === ticketId ? { ...ticket, status: newStatus } : ticket
            )
          );
          
          if (newStatus === "in_progress") {
            toast({
              title: t("success"),
              description: "You've started working on this ticket",
            });
          } else {
            toast({
              title: t("success"),
              description: t("ticket_status_updated"),
            });
          }
        }
      } else {
        // Try to get error details from the response
        let errorMessage = t("failed_to_update_ticket_status");
        try {
          const errorData = await response.json();
          if (errorData && errorData.error) {
            errorMessage = errorData.error;
          }
        } catch (e) {
          console.error("Error parsing error response:", e);
        }
        
        console.error(`Failed to update ticket status: ${response.status} ${errorMessage}`);
        toast({
          title: t("error"),
          description: errorMessage,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error updating ticket status:", error);
      toast({
        title: t("error"),
        description: t("failed_to_update_ticket_status"),
        variant: "destructive",
      });
    } finally {
      setUpdatingItemId(null);
    }
  };

  const getStatusIcon = (status: TaskStatus | TicketStatus) => {
    switch (status) {
      case "completed":
      case "resolved":
      case "closed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "in_progress":
        return <Clock className="w-5 h-5 text-blue-500" />;
      case "cancelled":
        return <AlertCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-yellow-500" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case "low":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
  };

  const getStatusColor = (status: TaskStatus | TicketStatus) => {
    switch (status) {
      case "completed":
      case "resolved":
      case "closed":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300 border-green-200 dark:border-green-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "cancelled":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-200 dark:border-red-800";
      default:
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString();
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getTimeRemaining = (dueDate: string) => {
    const now = new Date();
    const due = new Date(dueDate);
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: t("overdue"), color: "text-red-500" };
    } else if (diffDays === 0) {
      return { text: t("due_today"), color: "text-yellow-500" };
    } else if (diffDays === 1) {
      return { text: t("due_tomorrow"), color: "text-yellow-500" };
    } else {
      return { text: t("due_in_days", { days: diffDays }), color: "text-slate-500 dark:text-slate-400" };
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Card key={i} className="overflow-hidden border border-slate-200 dark:border-slate-700">
            <CardHeader className="pb-2">
              <Skeleton className="h-5 w-3/4" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-2/3" />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-8 w-1/4 rounded-md" />
            </CardFooter>
          </Card>
        ))}
      </div>
    );
  }

  if (tasks.length === 0 && tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <LayoutList className="w-12 h-12 text-slate-300 dark:text-slate-600 mb-3" />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          {t("no_assignments")}
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {t("no_assigned_items_description")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {tasks.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            <div className="flex items-center mb-3">
              <Calendar className="w-4 h-4 mr-2 text-indigo-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t("assigned_tasks")}
              </h3>
            </div>
            <div className="space-y-3">
              {tasks.map((task) => {
                const timeInfo = getTimeRemaining(task.dueDate);
                return (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2 }}
                    whileHover={{ y: -2, transition: { duration: 0.1 } }}
                    className="overflow-hidden"
                  >
                    <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <CardTitle className="text-base font-medium">{task.title}</CardTitle>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "ml-2 border", 
                              getPriorityColor(task.priority)
                            )}
                          >
                            {t(task.priority)}
                          </Badge>
                        </div>
                        <CardDescription className="line-clamp-2 mt-1">
                          {task.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="pb-3">
                        <div className="flex items-center mt-1">
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "flex items-center border", 
                              getStatusColor(task.status)
                            )}
                          >
                            {getStatusIcon(task.status)}
                            <span className="ml-1">{t(task.status)}</span>
                          </Badge>
                          <span className={cn("text-xs ml-3", timeInfo.color)}>
                            <Calendar className="inline-block w-3 h-3 mr-1" />
                            {timeInfo.text}
                          </span>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
                        <div className="flex items-center">
                          <Avatar className="h-6 w-6 mr-2">
                            <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                              {user ? getInitials(user.name || "U") : "U"}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDate(task.dueDate)}
                          </span>
                        </div>
                        <div className="flex space-x-2">
                          {task.status === "pending" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTaskStatus(task.id, "in_progress")}
                              disabled={updatingItemId === task.id}
                              className="text-xs h-8 bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800 dark:hover:bg-indigo-900/50"
                            >
                              {updatingItemId === task.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <ArrowRight className="w-3 h-3 mr-1" />
                              )}
                              {t("start")}
                            </Button>
                          )}
                          {task.status === "in_progress" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => updateTaskStatus(task.id, "completed")}
                              disabled={updatingItemId === task.id}
                              className="text-xs h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50"
                            >
                              {updatingItemId === task.id ? (
                                <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3 h-3 mr-1" />
                              )}
                              {t("complete")}
                            </Button>
                          )}
                        </div>
                      </CardFooter>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {tickets.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, delay: 0.1 }}
          >
            <div className="flex items-center mb-3">
              <Tag className="w-4 h-4 mr-2 text-blue-500" />
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                {t("assigned_tickets")}
              </h3>
            </div>
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <motion.div
                  key={ticket.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.2 }}
                  whileHover={{ y: -2, transition: { duration: 0.1 } }}
                  className="overflow-hidden"
                >
                  <Card className="overflow-hidden border border-slate-200 dark:border-slate-700 transition-all hover:shadow-md">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-base font-medium">
                          <span className="text-blue-500 font-mono mr-1">#{ticket.displayId}</span>
                          {ticket.title}
                        </CardTitle>
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "ml-2 border", 
                            getPriorityColor(ticket.priority)
                          )}
                        >
                          {t(ticket.priority)}
                        </Badge>
                      </div>
                      <CardDescription className="line-clamp-2 mt-1">
                        {ticket.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pb-3">
                      <div className="flex items-center mt-1">
                        <Badge 
                          variant="outline" 
                          className={cn(
                            "flex items-center border", 
                            getStatusColor(ticket.status)
                          )}
                        >
                          {getStatusIcon(ticket.status)}
                          <span className="ml-1">{t(ticket.status)}</span>
                        </Badge>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between border-t border-slate-200 dark:border-slate-700 pt-3">
                      <div className="flex items-center">
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarFallback className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                            {user ? getInitials(user.name || "U") : "U"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          {t("assigned_to_you")}
                        </span>
                      </div>
                      <div className="flex space-x-2">
                        {ticket.status === "open" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateTicketStatus(ticket.id, "in_progress")}
                            disabled={updatingItemId === ticket.id}
                            className="text-xs h-8 bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800 dark:hover:bg-blue-900/50"
                          >
                            {updatingItemId === ticket.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <ArrowRight className="w-3 h-3 mr-1" />
                            )}
                            {t("start")}
                          </Button>
                        )}
                        {ticket.status === "in_progress" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => updateTicketStatus(ticket.id, "resolved")}
                            disabled={updatingItemId === ticket.id}
                            className="text-xs h-8 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800 dark:hover:bg-green-900/50"
                          >
                            {updatingItemId === ticket.id ? (
                              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
                            ) : (
                              <CheckCircle className="w-3 h-3 mr-1" />
                            )}
                            {t("resolve")}
                          </Button>
                        )}
                      </div>
                    </CardFooter>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}