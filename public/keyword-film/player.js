(() => {
  'use strict';

  const video = document.getElementById('keyword-film');
  const status = document.getElementById('player-status');
  const chapters = Array.from(document.querySelectorAll('.chapter'));
  if (!(video instanceof HTMLVideoElement) || !status) return;

  const updateChapter = () => {
    chapters.forEach((chapter) => {
      const active = video.currentTime >= Number(chapter.dataset.time)
        && video.currentTime < Number(chapter.dataset.end);
      chapter.setAttribute('aria-pressed', String(active));
    });
  };

  chapters.forEach((chapter) => {
    chapter.addEventListener('click', async () => {
      const seekAndPlay = async () => {
        video.currentTime = Number(chapter.dataset.time);
        updateChapter();
        try {
          await video.play();
          status.textContent = '';
        } catch {
          status.textContent = '已跳转到所选年份，请点击视频中的播放按钮。';
        }
      };

      if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
        await seekAndPlay();
      } else {
        status.textContent = '正在准备视频…';
        video.addEventListener('loadedmetadata', seekAndPlay, { once: true });
        video.load();
      }
    });
  });

  video.addEventListener('timeupdate', updateChapter);
  video.addEventListener('seeked', updateChapter);
  video.addEventListener('error', () => {
    status.textContent = '视频暂时无法加载。请确认 MP4 文件与此页面放在同一目录，或使用下载链接观看。';
  });
  video.querySelector('source')?.addEventListener('error', () => {
    status.textContent = '视频暂时无法加载。请确认 MP4 文件与此页面放在同一目录，或使用下载链接观看。';
  });
})();
