(function () {
  function isVideoUrl(url) {
    return /\.(mp4|webm|ogg)(\?.*)?$/i.test(url || '');
  }

  function bindHoverToVideo(video) {
    if (!video) return;
    const playVideo = () => {
      if (video.readyState === 0) {
        video.load();
      }
      video.play().catch(() => {
        /* ignore autoplay errors */
      });
    };

    const resetVideo = () => {
      video.pause();
      video.currentTime = 0;
    };

    video.addEventListener('pointerenter', playVideo);
    video.addEventListener('pointerleave', resetVideo);
    video.addEventListener('pointerdown', playVideo);
    video.addEventListener('pointerup', resetVideo);
    video.addEventListener('pointercancel', resetVideo);
    video.addEventListener('touchstart', playVideo, { passive: true });
    video.addEventListener('touchend', resetVideo);
    video.addEventListener('touchcancel', resetVideo);
  }

  function bindTouchPlayHint(wrapper) {
    if (!wrapper) return;
    let timer = null;
    const showHint = () => {
      wrapper.classList.add('is-touch');
      if (timer) {
        clearTimeout(timer);
      }
      timer = setTimeout(() => {
        wrapper.classList.remove('is-touch');
      }, 1200);
    };
    wrapper.addEventListener('pointerdown', showHint);
    wrapper.addEventListener('touchstart', showHint, { passive: true });
  }

  function bindPlayButton(wrapper) {
    if (!wrapper) return;
    const button = wrapper.querySelector('.play-button');
    const video = wrapper.querySelector('video');
    if (!button || !video) return;

    wrapper.classList.add('has-video');
    button.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      if (video.paused) {
        if (video.readyState === 0) {
          video.load();
        }
        video.play().catch(() => {
          /* ignore autoplay errors */
        });
      } else {
        video.pause();
        video.currentTime = 0;
      }
    });
  }

  function splitCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    const cleanLine = line.replace(/^\uFEFF/, '');
    for (let i = 0; i < cleanLine.length; i += 1) {
      const char = cleanLine[i];
      const next = cleanLine[i + 1];

      if (char === '"') {
        if (inQuotes && next === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
        continue;
      }

      current += char;
    }

    result.push(current.trim());
    return result;
  }

  function parseCSV(text) {
    const lines = text.split(/\r?\n/).filter(line => line.trim().length);
    if (!lines.length) return [];
    const headers = splitCSVLine(lines.shift()).map(header => header.trim());

    return lines.map(line => {
      const values = splitCSVLine(line);
      return headers.reduce((acc, header, index) => {
        acc[header] = values[index] !== undefined ? values[index] : '';
        return acc;
      }, {});
    });
  }

  function resolveAffiliateCsvUrl() {
    const script = document.currentScript || Array.from(document.scripts).find(el => (el.src || '').includes('/js/related.js'));
    if (script && script.src) {
      try {
        return new URL('../data/afiliate.csv', script.src).toString();
      } catch (error) {
        /* ignore URL errors */
      }
    }
    return new URL('/data/afiliate.csv', window.location.origin).toString();
  }

  function getAffiliateUrl(item) {
    return item.afflink || item.singlelink || item.singlepageurl || '';
  }

  function getPageUrl(item) {
    return item.singlelink || item.singlepageurl || item.afflink || '';
  }

  function createRelatedCard(item) {
    const card = document.createElement('article');
    card.className = 'product-card';
    const mediaWrapper = document.createElement('div');
    mediaWrapper.className = 'media-wrapper';
    const mediaLink = document.createElement('a');
    mediaLink.href = getAffiliateUrl(item) || '#';
    mediaLink.target = '_blank';
    mediaLink.rel = 'nofollow noopener';

    const mediaUrl = item.videolink || item.imagelink || '';
    if (mediaUrl) {
      if (isVideoUrl(mediaUrl)) {
        const video = document.createElement('video');
        video.src = mediaUrl;
        video.muted = true;
        video.playsInline = true;
        video.setAttribute('preload', 'metadata');
        mediaLink.appendChild(video);
        bindHoverToVideo(video);
      } else {
        const img = document.createElement('img');
        img.src = mediaUrl;
        img.alt = item.title || 'Produk terkait';
        mediaLink.appendChild(img);
      }
    }

    const playButton = document.createElement('span');
    playButton.className = 'play-button';
    playButton.textContent = 'Play';
    mediaLink.appendChild(playButton);
    mediaWrapper.appendChild(mediaLink);
    bindTouchPlayHint(mediaWrapper);
    bindPlayButton(mediaWrapper);

    const content = document.createElement('div');
    content.className = 'video-content';
    const titleEl = document.createElement('h3');
    titleEl.className = 'video-title';

    const link = document.createElement('a');
    link.href = getAffiliateUrl(item) || '#';
    link.target = '_blank';
    link.rel = 'nofollow noopener';
    link.textContent = item.title || 'Produk terkait';
    titleEl.appendChild(link);

    const snippet = document.createElement('p');
    snippet.className = 'snippet';
    snippet.textContent = item.snippet || '';

    content.appendChild(titleEl);
    content.appendChild(snippet);

    card.appendChild(mediaWrapper);
    card.appendChild(content);
    return card;
  }

  function hydrateMainMedia() {
    const gallery = document.querySelector('.single-gallery');
    if (!gallery) return;
    const mainMedia = document.querySelector('.main-media');
    if (!mainMedia) return;

    const existingImg = document.getElementById('mainProductImage');
    const currentSrc = existingImg ? existingImg.getAttribute('src') : '';
    if (existingImg && isVideoUrl(currentSrc)) {
      const video = document.createElement('video');
      video.src = currentSrc;
      video.poster = existingImg.getAttribute('data-poster') || '';
      video.muted = true;
      video.playsInline = true;
      video.loop = true;
      video.setAttribute('preload', 'metadata');
      video.setAttribute('aria-label', existingImg.getAttribute('alt') || 'Video produk');
      mainMedia.replaceChild(video, existingImg);
      bindHoverToVideo(video);
    } else if (mainMedia) {
      const mainVideo = mainMedia.querySelector('video');
      bindHoverToVideo(mainVideo);
    }
    bindTouchPlayHint(mainMedia);
    bindPlayButton(mainMedia);

    const thumbs = Array.from(gallery.querySelectorAll('.thumb'));
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        const nextSrc = thumb.getAttribute('data-image');
        if (!nextSrc) return;

        const currentVideo = mainMedia.querySelector('video');
        const currentImage = mainMedia.querySelector('img');
        if (isVideoUrl(nextSrc)) {
          const nextVideo = document.createElement('video');
          nextVideo.src = nextSrc;
          nextVideo.muted = true;
          nextVideo.playsInline = true;
          nextVideo.loop = true;
          nextVideo.setAttribute('preload', 'metadata');
          nextVideo.setAttribute('aria-label', currentImage ? currentImage.getAttribute('alt') : 'Video produk');
          if (currentVideo) {
            mainMedia.replaceChild(nextVideo, currentVideo);
          } else if (currentImage) {
            mainMedia.replaceChild(nextVideo, currentImage);
          } else {
            mainMedia.prepend(nextVideo);
          }
          bindHoverToVideo(nextVideo);
          bindPlayButton(mainMedia);
        } else if (currentImage) {
          currentImage.src = nextSrc;
        } else {
          const img = document.createElement('img');
          img.id = 'mainProductImage';
          img.src = nextSrc;
          img.alt = 'Produk';
          if (currentVideo) {
            mainMedia.replaceChild(img, currentVideo);
          } else {
            mainMedia.prepend(img);
          }
        }

        thumbs.forEach(btn => btn.classList.remove('is-active'));
        thumb.classList.add('is-active');
      });
    });
  }

  async function renderRelated() {
    const relatedWrap = document.querySelector('.related-cards');
    if (!relatedWrap) return;
    const titleEl = document.querySelector('.single-hero .video-title');
    const currentTitle = (titleEl ? titleEl.textContent : '').trim();
    if (!currentTitle) return;

    const response = await fetch(resolveAffiliateCsvUrl());
    if (!response.ok) return;
    const csvText = await response.text();
    const items = parseCSV(csvText);

    const lowerTitle = currentTitle.toLowerCase();
    const currentItem = items.find(item => (item.title || '').toLowerCase() === lowerTitle);
    const currentCategory = currentItem ? (currentItem.category || '').toLowerCase() : '';

    const categoryMatches = items.filter(item => {
      if (!item.title) return false;
      const candidate = item.title.toLowerCase();
      if (candidate === lowerTitle) return false;
      if (!currentCategory) return false;
      return (item.category || '').toLowerCase() === currentCategory;
    });

    let related = categoryMatches;
    if (!related.length) {
      const keywords = lowerTitle
        .split(/\s+/)
        .map(word => word.replace(/[^a-z0-9]/g, ''))
        .filter(word => word.length > 3);

      related = items.filter(item => {
        if (!item.title) return false;
        const candidate = item.title.toLowerCase();
        if (candidate === lowerTitle) return false;
        return keywords.some(word => candidate.includes(word));
      });
    }

    related = related.slice(0, 3);

    relatedWrap.innerHTML = '';
    related.forEach(item => {
      relatedWrap.appendChild(createRelatedCard(item));
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateMainMedia();
    renderRelated().catch(() => {});
  });
})();
