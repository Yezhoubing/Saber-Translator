$(document).ready(function() {
    let images = [];
    let currentImageIndex = -1;
    const dropArea = $("#drop-area");
    const imageUploadInput = $("#imageUpload");
    const selectFileLink = $("#select-file-link");
    const translateButton = $("#translateButton");
    const translateAllButton = $("#translateAllButton");
    const prevImageButton = $("#prevImageButton");
    const nextImageButton = $("#nextImageButton");
    const loadingMessage = $("#loadingMessage");
    const loadingAnimation = $("#loadingAnimation");
    const errorMessage = $("#errorMessage");
    const resultSection = $("#result-section");
    const translatedImageDisplay = $("#translatedImageDisplay");
    const downloadButton = $("#downloadButton");
    const detectedTextInfo = $("#detectedTextInfo");
    const detectedTextList = $("#detectedTextList");
    const thumbnailList = $("#thumbnailList");


    // 阻止默认拖拽行为 - **确保 preventDefault 和 stopPropagation 正确调用**
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.on(eventName, function(e) {
            e.preventDefault(); // **关键: 阻止浏览器默认行为**
            e.stopPropagation(); // **关键: 阻止事件冒泡**
        });
    });

    // 高亮显示拖拽区域
    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.on(eventName, function() {
            dropArea.addClass('highlight');
        });
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.on(eventName, function() {
            dropArea.removeClass('highlight');
        });
    });

    // 处理拖拽上传
    dropArea.on('drop', function(e) {
        e.preventDefault(); // **再次确保 preventDefault**
        e.stopPropagation(); // **再次确保 stopPropagation**
        const dt = e.originalEvent.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // 点击 "点击选择文件" 链接触发文件选择
    selectFileLink.click(function(e) {
        e.preventDefault(); // 阻止链接默认跳转行为 (虽然这里不是链接)
        imageUploadInput.click();
    });


    imageUploadInput.change(function() {
        handleFiles(this.files);
    });


    function handleFiles(files) {
        if (files.length > 0) {
            errorMessage.hide();
            resultSection.hide();
            downloadButton.hide();
            detectedTextInfo.hide();
            translateButton.prop('disabled', true);
            translateAllButton.prop('disabled', true);
            prevImageButton.prop('disabled', true); // 上传新图片后禁用导航按钮
            nextImageButton.prop('disabled', true);

            images = [];
            thumbnailList.empty();
            currentImageIndex = -1;

            let filesArray = Array.from(files);

            Promise.all(filesArray.map((file, index) => {
                return new Promise((resolve, reject) => {
                    if (file.type.startsWith('image/')) {
                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const originalDataURL = e.target.result;
                            createThumbnail(originalDataURL, file.name, index).then(thumbnailDataURL => {
                                images.push({
                                    originalDataURL: originalDataURL,
                                    translatedDataURL: null,
                                    bubbleTexts: [],
                                    bubbleCoords: [],
                                    thumbnailDataURL: thumbnailDataURL,
                                    fileName: file.name
                                });
                                resolve();
                            }).catch(reject);
                        };
                        reader.onerror = reject;
                        reader.readAsDataURL(file);
                    } else {
                        reject("非图片文件");
                    }
                });
            }))
            .then(() => {
                loadingMessage.hide();
                loadingAnimation.hide();
                if (images.length > 0) {
                    translateButton.prop('disabled', false);
                    translateAllButton.prop('disabled', false);
                    renderThumbnails();
                    switchImage(0);
                } else {
                    errorMessage.text("没有选择任何图片或图片格式不正确").show();
                }
            })
            .catch(error => {
                loadingMessage.hide();
                loadingAnimation.hide();
                console.error("文件处理错误:", error);
                errorMessage.text("图片加载失败，请检查文件格式或重试").show();
            });

        }
    }


    function createThumbnail(imageSrc, fileName, index) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = function() {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const maxWidth = 100;
                const maxHeight = 100;
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width *= maxHeight / height;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, 0, 0, width, height);
                const thumbnailDataURL = canvas.toDataURL('image/jpeg');
                resolve(thumbnailDataURL);
            };
            img.onerror = reject;
            img.src = imageSrc;
        });
    }


    function renderThumbnails() {
        thumbnailList.empty();
        images.forEach((imageData, index) => {
            const listItem = $("<li></li>");
            const thumbnailImg = $("<img>").attr('src', imageData.thumbnailDataURL).attr('alt', imageData.fileName);
            listItem.append(thumbnailImg);
            listItem.click(function() {
                switchImage(index);
            });
            thumbnailList.append(listItem);
        });
        updateNavigationButtons(); // 初始化导航按钮状态
    }


    function switchImage(index) {
        if (index >= 0 && index < images.length) {
            currentImageIndex = index;
            console.log("switchImage called, index:", index, "currentImageIndex updated to:", currentImageIndex); // 调试日志
            translatedImageDisplay.attr('src', images[index].translatedDataURL || images[index].originalDataURL).show();
            resultSection.toggle(images[index].translatedDataURL !== null);
            downloadButton.toggle(images[index].translatedDataURL !== null);
            detectedTextInfo.toggle(images[index].bubbleTexts.length > 0 && images[index].translatedDataURL !== null);
            detectedTextList.text(images[index].bubbleTexts.join("\n"));

            $("#thumbnailList li").removeClass('active');
            $("#thumbnailList li").eq(index).addClass('active');

            updateNavigationButtons();
        }
    }

    // **新增函数：更新导航按钮状态**
    function updateNavigationButtons() {
        console.log("updateNavigationButtons called, currentImageIndex:", currentImageIndex, "images.length:", images.length); // 调试日志
        if (images.length <= 1) {
            prevImageButton.prop('disabled', true);
            nextImageButton.prop('disabled', true);
        } else {
            prevImageButton.prop('disabled', currentImageIndex <= 0);
            nextImageButton.prop('disabled', currentImageIndex >= images.length - 1);
        }
    }


    // "上一张" 按钮点击事件
    prevImageButton.click(function() {
        console.log("prevImageButton clicked, currentImageIndex before:", currentImageIndex); // 调试日志
        if (currentImageIndex > 0) {
            switchImage(currentImageIndex - 1);
        }
    });

    // "下一张" 按钮点击事件
    nextImageButton.click(function() {
        console.log("nextImageButton clicked, currentImageIndex before:", currentImageIndex); // 调试日志
        if (currentImageIndex < images.length - 1) {
            switchImage(currentImageIndex + 1);
        }
    });


    translateButton.click(function() {
        if (currentImageIndex === -1) {
            alert("请先选择要翻译的图片");
            return;
        }

        loadingMessage.show();
        loadingAnimation.show();
        errorMessage.hide();
        resultSection.hide();
        downloadButton.hide();
        detectedTextInfo.hide();

        const targetLanguage = $("#targetLanguage").val();
        const apiKey = $("#apiKey").val();
        const modelName = $("#modelName").val();
        const fontSize = $("#fontSize").val();
        const imageData = images[currentImageIndex].originalDataURL.split(',')[1];


        $.ajax({
            type: 'POST',
            url: '/translate_image',
            data: JSON.stringify({
                image: imageData,
                target_language: targetLanguage,
                textDirection: 'vertical',
                fontSize: fontSize,
                model_provider: 'siliconflow',
                api_key: apiKey,
                model_name: modelName
            }),
            contentType: 'application/json; charset=utf-8',
            dataType: 'json',
            success: function(response) {
                loadingMessage.hide();
                loadingAnimation.hide();
                images[currentImageIndex].translatedDataURL = 'data:image/png;base64,' + response.translated_image;
                images[currentImageIndex].bubbleTexts = response.bubble_texts || [];
                images[currentImageIndex].bubbleCoords = response.bubble_coords || [];

                switchImage(currentImageIndex);

            },
            error: function(error) {
                loadingMessage.hide();
                loadingAnimation.hide();
                resultSection.hide();
                downloadButton.hide();
                detectedTextInfo.hide();

                console.error('Error:', error);
                if (error.responseJSON && error.responseJSON.error) {
                    errorMessage.text("错误: " + error.responseJSON.error).show();
                } else {
                    errorMessage.text("处理出错，请查看控制台。").show();
                }
            }
        });
    });



    translateAllButton.click(function() {
        if (images.length === 0) {
            alert("请先上传漫画图片");
            return;
        }
        translateAllImages();
    });


    function translateAllImages() {
        loadingMessage.show();
        loadingAnimation.show();
        errorMessage.hide();
        resultSection.hide();
        downloadButton.hide();
        detectedTextInfo.hide();
        translateButton.prop('disabled', true);
        translateAllButton.prop('disabled', true);

        const targetLanguage = $("#targetLanguage").val();
        const apiKey = $("#apiKey").val();
        const modelName = $("#modelName").val();
        const fontSize = $("#fontSize").val();

        Promise.all(images.map((imageData, index) => {
            return new Promise((resolve, reject) => {
                const postData = {
                    image: imageData.originalDataURL.split(',')[1],
                    target_language: targetLanguage,
                    textDirection: 'vertical',
                    fontSize: fontSize,
                    model_provider: 'siliconflow',
                    api_key: apiKey,
                    model_name: modelName
                };

                $.ajax({
                    type: 'POST',
                    url: '/translate_image',
                    data: JSON.stringify(postData),
                    contentType: 'application/json; charset=utf-8',
                    dataType: 'json',
                    success: function(response) {
                        images[index].translatedDataURL = 'data:image/png;base64,' + response.translated_image;
                        images[index].bubbleTexts = response.bubble_texts || [];
                        images[index].bubbleCoords = response.bubble_coords || [];
                        resolve();
                    },
                    error: function(error) {
                        console.error(`图片 ${imageData.fileName} 翻译失败:`, error);
                        resolve();
                    }
                });
            });
        }))
        .then(() => {
            loadingMessage.hide();
            loadingAnimation.hide();
            translateButton.prop('disabled', false);
            translateAllButton.prop('disabled', false);

            if (currentImageIndex !== -1) {
                switchImage(currentImageIndex);
            } else if (images.length > 0) {
                switchImage(0);
            }

            alert("所有图片翻译完成 (部分图片可能翻译失败，请查看控制台)");
        });
    }


    downloadButton.click(function(e) {
        if (currentImageIndex !== -1 && images[currentImageIndex].translatedDataURL) {
            const dataURL = images[currentImageIndex].translatedDataURL;
            const a = document.createElement('a');
            a.href = dataURL;
            a.download = images[currentImageIndex].fileName.replace(/\..+$/, '') + '_translated.png';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            alert("没有可下载的翻译后图片");
        }
    });


    translateAllButton.prop('disabled', true);
    prevImageButton.prop('disabled', true); // 初始禁用导航按钮
    nextImageButton.prop('disabled', true);

    const originalHandleFiles = handleFiles;
    handleFiles = function(files) {
        originalHandleFiles(files);
        translateAllButton.prop('disabled', false);
    };


});
