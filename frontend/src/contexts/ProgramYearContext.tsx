import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ProgramYear, getCurrentProgramYear, getProgramYear } from '../utils/programYear';

interface ProgramYearContextType {
  selectedProgramYear: ProgramYear;
  setSelectedProgramYear: (programYear: ProgramYear) => void;
  selectedDate: string | undefined;
  setSelectedDate: (date: string | undefined) => void;
}

const ProgramYearContext = createContext<ProgramYearContextType | undefined>(undefined);

interface ProgramYearProviderProps {
  children: ReactNode;
}

export const ProgramYearProvider: React.FC<ProgramYearProviderProps> = ({ children }) => {
  // Initialize with current program year
  const [selectedProgramYear, setSelectedProgramYear] = useState<ProgramYear>(getCurrentProgramYear());
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Load from localStorage on mount
  useEffect(() => {
    const savedYear = localStorage.getItem('selectedProgramYear');
    if (savedYear) {
      try {
        const year = parseInt(savedYear);
        setSelectedProgramYear(getProgramYear(year));
      } catch (error) {
        console.error('Failed to load saved program year:', error);
      }
    }
  }, []);

  // Save to localStorage when changed
  useEffect(() => {
    localStorage.setItem('selectedProgramYear', selectedProgramYear.year.toString());
  }, [selectedProgramYear]);

  const value: ProgramYearContextType = {
    selectedProgramYear,
    setSelectedProgramYear,
    selectedDate,
    setSelectedDate,
  };

  return <ProgramYearContext.Provider value={value}>{children}</ProgramYearContext.Provider>;
};

export const useProgramYear = (): ProgramYearContextType => {
  const context = useContext(ProgramYearContext);
  if (context === undefined) {
    throw new Error('useProgramYear must be used within a ProgramYearProvider');
  }
  return context;
};
