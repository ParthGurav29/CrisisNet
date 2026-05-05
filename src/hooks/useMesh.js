import { useContext } from 'react';
import { MeshContext } from '../context/MeshContext';

export const useMesh = () => {
  const context = useContext(MeshContext);
  if (!context) {
    throw new Error('useMesh must be used within a MeshProvider');
  }
  return context;
};
