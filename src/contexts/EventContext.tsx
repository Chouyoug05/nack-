import { createContext, useContext, useState, ReactNode } from "react";

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  maxCapacity: number;
  ticketPrice: number;
  currency: string;
  createdAt: Date;
  isActive: boolean;
  ticketsSold: number;
  shareableLink: string;
  imageUrl?: string;
}

interface EventContextType {
  events: Event[];
  addEvent: (event: Event) => void;
  getEventById: (id: string) => Event | undefined;
  updateEvent: (id: string, event: Partial<Event>) => void;
  deleteEvent: (id: string) => void;
}

const EventContext = createContext<EventContextType | undefined>(undefined);

export const useEvents = () => {
  const context = useContext(EventContext);
  if (!context) {
    throw new Error('useEvents must be used within an EventProvider');
  }
  return context;
};

export const EventProvider = ({ children }: { children: ReactNode }) => {
  const [events, setEvents] = useState<Event[]>([
    {
      id: "1",
      title: "Soirée Jazz",
      description: "Une soirée musicale exceptionnelle avec les meilleurs artistes jazz de la région",
      date: "2024-02-20",
      time: "20:00",
      location: "Restaurant NACK - Salle principale",
      maxCapacity: 80,
      ticketPrice: 15000,
      currency: "XAF",
      createdAt: new Date(),
      isActive: true,
      ticketsSold: 23,
      shareableLink: `${window.location.origin}/event/1`,
      imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=1000&q=80"
    }
  ]);

  const addEvent = (event: Event) => {
    setEvents(prev => [...prev, event]);
  };

  const getEventById = (id: string) => {
    return events.find(event => event.id === id);
  };

  const updateEvent = (id: string, updatedEvent: Partial<Event>) => {
    setEvents(prev => prev.map(event => 
      event.id === id ? { ...event, ...updatedEvent } : event
    ));
  };

  const deleteEvent = (id: string) => {
    setEvents(prev => prev.filter(event => event.id !== id));
  };

  return (
    <EventContext.Provider value={{
      events,
      addEvent,
      getEventById,
      updateEvent,
      deleteEvent
    }}>
      {children}
    </EventContext.Provider>
  );
};