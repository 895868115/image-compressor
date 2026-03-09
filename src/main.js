import Compressor from 'compressorjs';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

// 全局变量
let uploadedImages = [];
let compressedImages = [];

// DOM元素
const fileInput = document.getElementById('fileInput');
const compressBtn = document.getElementById('compressBtn');
const downloadAllBtn = document.getElementById('downloadAllBtn');
const previewContainer = document.getElementById('previewContainer');
const compressLevel = document.getElementById('compressLevel');
const formatConvert = document.getElementById('formatConvert');

// 图片预览模态框
const imageModal = document.getElementById('imageModal');
const modalImage = document.getElementById('modalImage');
const closeBtn = document.querySelector('.close');

// 上传进度条
const uploadArea = document.querySelector('.upload-area');
let progressBar = null;

// 初始化事件监听器
function initEventListeners() {
  // 文件上传监听
  fileInput.addEventListener('change', handleFileUpload);

  // 压缩按钮点击
  compressBtn.addEventListener('click', handleCompress);

  // 批量下载按钮点击
  downloadAllBtn.addEventListener('click', handleDownloadAll);

  // 拖拽上传
  const uploadArea = document.querySelector('.upload-area');
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#4caf50';
  });

  uploadArea.addEventListener('dragleave', () => {
    uploadArea.style.borderColor = '#81c784';
  });

  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.style.borderColor = '#81c784';
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  });

  // 模态框关闭事件
  closeBtn.addEventListener('click', () => {
    imageModal.style.display = 'none';
  });

  // 点击模态框外部关闭
  imageModal.addEventListener('click', (e) => {
    if (e.target === imageModal) {
      imageModal.style.display = 'none';
    }
  });
}

// 处理文件上传
function handleFileUpload(e) {
  const files = e.target.files;
  if (files.length > 0) {
    handleFiles(files);
  }
}

// 处理文件
function handleFiles(files) {
  // 保留现有的图片，不覆盖
  // 只在没有图片时禁用下载按钮
  if (uploadedImages.length === 0) {
    downloadAllBtn.disabled = true;
  }

  // 创建上传进度条
  createProgressBar();

  const totalFiles = files.length;
  let loadedFiles = 0;
  const maxSize = 10 * 1024 * 1024; // 10MB

  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/')) {
      // 检查文件大小
      if (file.size > maxSize) {
        alert(`图片 ${file.name} 超过10MB限制，请选择更小的图片`);
        loadedFiles++;
        updateProgressBar(loadedFiles / totalFiles);

        if (loadedFiles === totalFiles) {
          setTimeout(() => {
            removeProgressBar();
          }, 500);
        }
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = {
          file: file,
          originalUrl: e.target.result,
          compressedUrl: null,
          originalSize: file.size,
          compressedSize: 0,
          name: file.name
        };
        uploadedImages.push(imageData);
        renderImagePreview(imageData);

        loadedFiles++;
        updateProgressBar(loadedFiles / totalFiles);

        if (loadedFiles === totalFiles) {
          setTimeout(() => {
            removeProgressBar();
          }, 500);
        }
      };
      reader.readAsDataURL(file);
    } else {
      loadedFiles++;
      updateProgressBar(loadedFiles / totalFiles);
    }
  });
}

// 创建上传进度条
function createProgressBar() {
  removeProgressBar(); // 先移除已有的进度条

  progressBar = document.createElement('div');
  progressBar.className = 'upload-progress';
  progressBar.innerHTML = '<div class="upload-progress-bar" style="width: 0%"></div>';

  uploadArea.appendChild(progressBar);
}

// 更新上传进度条
function updateProgressBar(progress) {
  if (progressBar) {
    const bar = progressBar.querySelector('.upload-progress-bar');
    bar.style.width = (progress * 100) + '%';
  }
}

// 移除上传进度条
function removeProgressBar() {
  if (progressBar && progressBar.parentNode) {
    progressBar.parentNode.removeChild(progressBar);
    progressBar = null;
  }
}

// 处理删除图片
function handleDeleteImage(index) {
  // 从数组中移除
  uploadedImages.splice(index, 1);
  compressedImages.splice(index, 1);

  // 重新渲染预览
  previewContainer.innerHTML = '';
  uploadedImages.forEach((imageData, newIndex) => {
    renderImagePreview(imageData);
  });

  // 更新批量下载按钮状态
  if (uploadedImages.length === 0) {
    downloadAllBtn.disabled = true;
  }
}

// 渲染图片预览
function renderImagePreview(imageData) {
  const imageCard = document.createElement('div');
  imageCard.className = 'image-card';
  imageCard.dataset.index = uploadedImages.indexOf(imageData);

  imageCard.innerHTML = `
    <img src="${imageData.originalUrl}" alt="${imageData.name}" class="image-preview">
    <div class="image-info">
      <span class="file-name">${imageData.name}</span>
      <span class="file-size">${formatFileSize(imageData.originalSize)}</span>
    </div>
    <div class="image-actions">
      <button class="delete-btn">删除</button>
      <button class="download-btn" disabled>下载</button>
    </div>
  `;

  // 添加删除按钮事件
  const deleteBtn = imageCard.querySelector('.delete-btn');
  deleteBtn.addEventListener('click', () => {
    const index = parseInt(imageCard.dataset.index);
    handleDeleteImage(index);
  });

  // 添加图片点击事件
  const img = imageCard.querySelector('.image-preview');
  img.style.cursor = 'pointer';
  img.addEventListener('click', () => {
    openImageModal(imageData.originalUrl);
  });

  previewContainer.appendChild(imageCard);
}

// 打开图片预览模态框
function openImageModal(imageUrl) {
  modalImage.src = imageUrl;
  imageModal.style.display = 'block';
}

// 处理压缩
function handleCompress() {
  if (uploadedImages.length === 0) {
    alert('请先上传图片');
    return;
  }

  compressBtn.disabled = true;
  compressBtn.innerHTML = '<span class="loading"></span> 压缩中...';

  const level = compressLevel.value;
  const format = formatConvert.value;
  let compressCount = 0;

  uploadedImages.forEach((imageData, index) => {
    new Compressor(imageData.file, {
      quality: getCompressQuality(level),
      maxWidth: 1920,
      maxHeight: 1080,
      convertSize: Infinity,
      mimeType: getMimeType(format, imageData.file.type),
      success: (result) => {
        const reader = new FileReader();
        reader.onload = (e) => {
          imageData.compressedUrl = e.target.result;
          imageData.compressedSize = result.size;
          // 更新文件名以反映新格式
          if (format !== 'original') {
            const nameParts = imageData.name.split('.');
            nameParts.pop();
            imageData.name = nameParts.join('.') + '.' + format;
          }
          compressedImages[index] = imageData;

          // 更新预览
          updateImagePreview(index, imageData);

          compressCount++;
          if (compressCount === uploadedImages.length) {
            compressBtn.disabled = false;
            compressBtn.innerHTML = '一键压缩';
            downloadAllBtn.disabled = false;
          }
        };
        reader.readAsDataURL(result);
      },
      error: (err) => {
        console.error('压缩失败:', err);
        compressCount++;
        if (compressCount === uploadedImages.length) {
          compressBtn.disabled = false;
          compressBtn.innerHTML = '一键压缩';
        }
      }
    });
  });
}

// 获取目标MIME类型
function getMimeType(format, originalType) {
  switch (format) {
    case 'jpg':
      return 'image/jpeg';
    case 'webp':
      return 'image/webp';
    case 'original':
    default:
      return originalType;
  }
}

// 获取压缩质量
function getCompressQuality(level) {
  switch (level) {
    case 'low':
      return 0.8;
    case 'medium':
      return 0.6;
    case 'high':
      return 0.4;
    default:
      return 0.6;
  }
}

// 更新图片预览
function updateImagePreview(index, imageData) {
  const imageCard = previewContainer.children[index];
  if (imageCard) {
    // 更新图片
    const img = imageCard.querySelector('.image-preview');
    img.src = imageData.compressedUrl;
    img.style.cursor = 'pointer';

    // 重新添加点击事件
    img.addEventListener('click', () => {
      openImageModal(imageData.compressedUrl);
    });

    // 更新文件名
    const fileName = imageCard.querySelector('.file-name');
    fileName.textContent = imageData.name;

    // 更新信息
    const sizeInfo = imageCard.querySelector('.file-size');
    sizeInfo.textContent = `${formatFileSize(imageData.compressedSize)} (${Math.round((1 - imageData.compressedSize / imageData.originalSize) * 100)}% 减少)`;

    // 启用下载按钮
    const downloadBtn = imageCard.querySelector('.download-btn');
    downloadBtn.disabled = false;
    downloadBtn.addEventListener('click', () => handleDownloadSingle(index));
  }
}

// 处理单张下载
function handleDownloadSingle(index) {
  const imageData = compressedImages[index];
  if (imageData && imageData.compressedUrl) {
    const link = document.createElement('a');
    link.href = imageData.compressedUrl;
    link.download = `compressed_${imageData.name}`;
    link.click();
  }
}

// 处理批量下载
function handleDownloadAll() {
  if (compressedImages.length === 0) {
    alert('请先压缩图片');
    return;
  }

  const zip = new JSZip();
  let addedCount = 0;

  compressedImages.forEach((imageData, index) => {
    if (imageData.compressedUrl) {
      // 从base64转换为blob
      const base64 = imageData.compressedUrl.split(',')[1];
      const binary = atob(base64);
      const array = [];
      for (let i = 0; i < binary.length; i++) {
        array.push(binary.charCodeAt(i));
      }
      const blob = new Blob([new Uint8Array(array)], { type: imageData.file.type });

      zip.file(`compressed_${imageData.name}`, blob);
      addedCount++;

      if (addedCount === compressedImages.length) {
        zip.generateAsync({ type: 'blob' }).then((content) => {
          saveAs(content, 'compressed_images.zip');
        });
      }
    }
  });
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// 初始化应用
function initApp() {
  initEventListeners();
  console.log('图片压缩工具初始化完成');
}

// 启动应用
initApp();