// SafeImage.js
import React, { useState, useEffect } from 'react';
import { API_BASE } from '../config/pushConfig';

export default function SafeImage({ src, alt, onError, ...props }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    // Reset states when src changes
    setLoading(true);
    setError(false);

    if (!src) {
      setLoading(false);
      setImageSrc(null);
      return;
    }

    // If src is already a full URL, use it directly
    const url = src.startsWith('http') ? src : `${API_BASE}${src.startsWith('/') ? '' : '/'}${src}`;

    const fetchImage = async () => {
      try {
        const response = await fetch(url, {
          headers: {
            'ngrok-skip-browser-warning': 'true',
          },
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);
        setImageSrc(objectUrl);
        setLoading(false);
      } catch (err) {
        console.error('SafeImage load error:', err);
        setError(true);
        setLoading(false);
        if (onError) onError(err);
      }
    };

    fetchImage();

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
