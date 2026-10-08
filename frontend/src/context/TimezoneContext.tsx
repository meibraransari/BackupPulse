import React, { createContext, useContext, useState, useEffect } from 'react';

export type TimezoneMode = 'LOCAL' | 'UTC';

interface TimezoneContextType {
  timezone: TimezoneMode;
  setTimezone: (tz: TimezoneMode) => void;
  toggleTimezone: () => void;
  formatTimestamp: (dateInput: string | Date | null | undefined) => string;
  formatDateOnly: (dateInput: string | Date | null | undefined) => string;
  formatTimeOnly: (dateInput: string | Date | null | undefined) => string;
}

const STORAGE_KEY = 'backuppulse_timezone_mode';

const TimezoneContext = createContext<TimezoneContextType | undefined>(undefined);

export const TimezoneProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [timezone, setTimezoneState] = useState<TimezoneMode>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'UTC' ? 'UTC' : 'LOCAL';
  });

  const setTimezone = (tz: TimezoneMode) => {
    setTimezoneState(tz);
    localStorage.setItem(STORAGE_KEY, tz);
  };

  const toggleTimezone = () => {
    setTimezone(timezone === 'UTC' ? 'LOCAL' : 'UTC');
  };

  const parseDate = (dateInput: string | Date | null | undefined): Date | null => {
    if (!dateInput) return null;
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    return isNaN(d.getTime()) ? null : d;
  };

  const formatTimestamp = (dateInput: string | Date | null | undefined): string => {
    const d = parseDate(dateInput);
    if (!d) return '—';

    if (timezone === 'UTC') {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} UTC`;
    } else {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    }
  };

  const formatDateOnly = (dateInput: string | Date | null | undefined): string => {
    const d = parseDate(dateInput);
    if (!d) return '—';

    if (timezone === 'UTC') {
      const year = d.getUTCFullYear();
      const month = String(d.getUTCMonth() + 1).padStart(2, '0');
      const day = String(d.getUTCDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    } else {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  };

  const formatTimeOnly = (dateInput: string | Date | null | undefined): string => {
    const d = parseDate(dateInput);
    if (!d) return '—';

    if (timezone === 'UTC') {
      const hours = String(d.getUTCHours()).padStart(2, '0');
      const minutes = String(d.getUTCMinutes()).padStart(2, '0');
      const seconds = String(d.getUTCSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds} UTC`;
    } else {
      const hours = String(d.getHours()).padStart(2, '0');
      const minutes = String(d.getMinutes()).padStart(2, '0');
      const seconds = String(d.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
  };

  return (
    <TimezoneContext.Provider
      value={{
        timezone,
        setTimezone,
        toggleTimezone,
        formatTimestamp,
        formatDateOnly,
        formatTimeOnly,
      }}
    >
      {children}
    </TimezoneContext.Provider>
  );
};

export const useTimezone = (): TimezoneContextType => {
  const context = useContext(TimezoneContext);
  if (!context) {
    throw new Error('useTimezone must be used within a TimezoneProvider');
  }
  return context;
};
