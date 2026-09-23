import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllConfigurations, initializeConfigurations } from '../api/config';

// Create the context
const ConfigContext = createContext({
  currentSession: 'January 2025', // Default value
  times: [8, 9, 10, 11, 12, 1, 2, 3, 4], // Default values
  days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
  possibleLabTimes: [8, 11, 2],
  loading: true,
  error: null,
  refreshConfigs: () => {}
});

// Provider component
export const ConfigProvider = ({ children }) => {
  const [configs, setConfigs] = useState({
    currentSession: 'January 2025', // Default value
    times: [8, 9, 10, 11, 12, 1, 2, 3, 4], // Default values
    days: ["Saturday", "Sunday", "Monday", "Tuesday", "Wednesday"],
    possibleLabTimes: [8, 11, 2],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadConfigurations = async () => {
    try {
      setLoading(true);
      const allConfigs = await getAllConfigurations();
      
      // Create a config object from the array of key-value pairs
      const configsObject = allConfigs.reduce((acc, config) => {
        acc[config.key] = config.value;
        return acc;
      }, {});
      
      // Update state with fetched configs, falling back to defaults if not available
      setConfigs(prev => ({
        currentSession: configsObject.CURRENT_SESSION || prev.currentSession,
        times: configsObject.times || prev.times,
        days: configsObject.days || prev.days,
        possibleLabTimes: configsObject.possibleLabTimes || prev.possibleLabTimes
      }));
      
      setError(null);
    } catch (err) {
      console.error('Error loading configurations:', err);
      setError('Failed to load system configurations');
      
      // If configs don't exist, initialize them
      if (err.response && (err.response.status === 404 || err.response.data?.success === false)) {
        try {
          await initializeConfigurations();
          // Try loading again after initialization
          loadConfigurations();
        } catch (initErr) {
          console.error('Error initializing configurations:', initErr);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // Load configurations on mount
  useEffect(() => {
    loadConfigurations();
  }, []);

  return (
    <ConfigContext.Provider value={{ 
      ...configs, 
      loading, 
      error, 
      refreshConfigs: loadConfigurations 
    }}>
      {children}
    </ConfigContext.Provider>
  );
};

// Hook for using the config context
export const useConfig = () => useContext(ConfigContext);
