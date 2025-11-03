// src/components/SafeImage.js
// Component that loads images with proper ngrok headers

import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/pushConfig';

export default function SafeImage({ src, alt, onError, ...props }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // If src is a full URL, use it directly
    if (src?.startsWith('http')) {
      setImageSrc(src);
      setLoading(false);
      return;
    }

    // Otherwise, fetch the image with proper headers
    const fetchImage = async () => {
      try {
        setLoading(true);
        setError(false);

        const imageUrl = src?.startsWith('/') ? `${API_BASE}${src}` : `${API_BASE}/${src}`;
        
        const response = await fetch(imageUrl, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        console.error('Error loading image:', err);
        setError(true);
        setLoading(false);
        if (onError) onError(err);
      }
    };

    if (src) {
      fetchImage();
    }

    // Cleanup blob URL on unmount
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div {...props} style={{
        ...props.style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        color: '#9ca3af'
      }}>
        Loading...
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div {...props} style={{
        ...props.style,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#fee2e2',
        color: '#ef4444'
      }}>
        ❌ Image unavailable
      </div>
    );
  }

  return <img src={imageSrc} alt={alt} {...props} />;
}