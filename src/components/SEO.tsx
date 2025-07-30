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
  description = 'KBS Tractors - Leading provider of tractor rental and sales management solutions. Professional equipment tracking, rental management, and business administration tools for agricultural and construction industries.',
  keywords = 'KBS, KBS Tractors, tractor rental, tractor sales, equipment management, agricultural machinery, construction equipment, rental management system, business administration, KBS equipment',
  image = '/icons/KBS TRACTORS Emblem Logo - Green and Gray.jpg',
  url = 'https://kbstractors.vercel.app/',
  type = 'website',
  canonical
}) => {
  const fullUrl = canonical || url;
  const fullImageUrl = image.startsWith('http') ? image : `${url}${image}`;

  return (
    <Helmet data-testid="seo-helmet">
      {/* Basic Meta Tags */}
      <title data-testid="seo-title">{title}</title>
      <meta data-testid="seo-description" name="description" content={description} />
      <meta data-testid="seo-keywords" name="keywords" content={keywords} />
      {canonical && <link data-testid="seo-canonical" rel="canonical" href={canonical} />}

      {/* Open Graph Meta Tags */}
      <meta data-testid="og-title" property="og:title" content={title} />
      <meta data-testid="og-description" property="og:description" content={description} />
      <meta data-testid="og-type" property="og:type" content={type} />
      <meta data-testid="og-url" property="og:url" content={fullUrl} />
      <meta data-testid="og-image" property="og:image" content={fullImageUrl} />
      <meta data-testid="og-image-width" property="og:image:width" content="1200" />
      <meta data-testid="og-image-height" property="og:image:height" content="630" />
      <meta data-testid="og-site-name" property="og:site_name" content="KBS Tractors" />
      <meta data-testid="og-locale" property="og:locale" content="en_US" />

      {/* Twitter Card Meta Tags */}
      <meta data-testid="twitter-card" name="twitter:card" content="summary_large_image" />
      <meta data-testid="twitter-title" name="twitter:title" content={title} />
      <meta data-testid="twitter-description" name="twitter:description" content={description} />
      <meta data-testid="twitter-image" name="twitter:image" content={fullImageUrl} />

      {/* Additional SEO Meta Tags */}
      <meta data-testid="robots" name="robots" content="index, follow" />
      <meta data-testid="googlebot" name="googlebot" content="index, follow" />
    </Helmet>
  );
}; 