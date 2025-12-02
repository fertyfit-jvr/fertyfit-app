// Convert standard YouTube URLs to Embed URLs
export const getEmbedUrl = (url: string): string => {
  if (!url) return '';
  let embedUrl = url;

  if (url.includes('watch?v=')) {
    const v = url.split('v=')[1]?.split('&')[0];
    embedUrl = `https://www.youtube.com/embed/${v}`;
  } else if (url.includes('youtu.be/')) {
    const id = url.split('youtu.be/')[1]?.split('?')[0];
    embedUrl = `https://www.youtube.com/embed/${id}`;
  } else if (url.includes('drive.google.com')) {
    // Convert view/sharing links to preview
    const parts = url.split('/');
    const dIndex = parts.indexOf('d');
    if (dIndex !== -1 && parts[dIndex + 1]) {
      embedUrl = `https://drive.google.com/file/d/${parts[dIndex + 1]}/preview`;
    }
  } else if (url.includes('vimeo.com')) {
    const id = url.split('vimeo.com/')[1]?.split('?')[0];
    if (id && !url.includes('player.vimeo.com')) {
      embedUrl = `https://player.vimeo.com/video/${id}`;
    }
  }

  return embedUrl;
};

