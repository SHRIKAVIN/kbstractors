import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOProps {
  title?: string;
  description?: string;
  keywords?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  canonical?: string;
}

export const SEO: React.FC<SEOProps> = ({
  title = 'KBS Tractors - Professional Tractor Rental & Sales Management System',
  description = 'KBS Tractors provides comprehensive tractor rental and sales management solutions. Professional equipment tracking, rental management, and business administration tools for agricultural and construction industries.',
  keywords = 'tractor rental, tractor sales, equipment management, agricultural machinery, construction equipment, KBS Tractors, rental management system, business administration',
  image = '/icons/KBS TRACTORS Emblem Logo - Green and Gray.jpg',
  url = 'https://kbstractors.vercel.app/',
  type = 'website',
  canonical
}) => {
  const fullUrl = canonical || url;
  const fullImageUrl = image.startsWith('http') ? image : `${url}${image}`;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywords} />
      {canonical && <link rel="canonical" href={canonical} />}

      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:image" content={fullImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:site_name" content="KBS Tractors" />
      <meta property="og:locale" content="en_US" />

      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImageUrl} />

      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="googlebot" content="index, follow" />
    </Helmet>
  );
}; 