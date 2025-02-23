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
    const downloadAllImagesButton = $("#downloadAllImagesButton"); // 获取按钮引用
    const detectedTextInfo = $("#detectedTextInfo");
    const detectedTextList = $("#detectedTextList");
    const thumbnailList = $("#thumbnailList");
    const modelProviderSelect = $("#modelProvider");
    const modelNameInput = $("#modelName");
    const modelSuggestionsDiv = $("#model-suggestions");

    // 新增：获取提示信息元素引用
    const translatingMessage = $("#translatingMessage");
    const downloadingMessage = $("#downloadingMessage");

    // 阻止默认拖拽行为
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.on(eventName, function(e) {
            e.preventDefault();
            e.stopPropagation();
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
        e.preventDefault();
        e.stopPropagation();
        const dt = e.originalEvent.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    // 点击 "点击选择文件" 链接触发文件选择
    selectFileLink.click(function(e) {
        e.preventDefault();
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
            downloadAllImagesButton.hide(); // 隐藏按钮
            detectedTextInfo.hide();
            translateButton.prop('disabled', true);
            translateAllButton.prop('disabled', true);
            prevImageButton.prop('disabled', true);
            nextImageButton.prop('disabled', true);

            images = [];
            thumbnailList.empty();
            currentImageIndex = -1;

           //不再使用promise.all， 使用原生的for循环一个一个判断
            let filesArray = Array.from(files);
                for (let i = 0; i < filesArray.length; i++) {
                    const file = filesArray[i];
                    if (file.type.startsWith('image/')) {

                        const reader = new FileReader();
                        reader.onload = function(e) {
                            const originalDataURL = e.target.result;
                            createThumbnail(originalDataURL, file.name, i).then(thumbnailDataURL => {
                                images.push({
                                    originalDataURL: originalDataURL,
                                    translatedDataURL: null,
                                    bubbleTexts: [],
                                    bubbleCoords: [],
                                    thumbnailDataURL: thumbnailDataURL,
                                    fileName: file.name
                                });
                                 if (i === filesArray.length - 1) {
                                    //图片是最后一张图片
                                    finishHandleFiles();

                                }
                            }).catch(error =>{
                                errorMessage.text("图片加载失败，请检查文件格式或重试").show();
                                return;
                            });
                        };
                        reader.onerror = function(){
                            errorMessage.text("图片加载失败，请检查文件格式或重试").show();
                            return;
                        };
                        reader.readAsDataURL(file);
                         console.log("是图片");
                    } else if (file.type === 'application/pdf') {
                         const formData = new FormData(); // 创建 FormData 对象
                         formData.append('pdfFile', file); // 添加 PDF 文件到 FormData
                         $.ajax({
                            url: '/upload_pdf',
                            type: 'POST',
                            data: formData,
                            contentType: false,
                            processData: false,
                            dataType: 'json',
                            success: function(response) {
                                 if (response.images && response.images.length > 0) {
                                      let imagesArray = response.images

                                     Promise.all(imagesArray.map((imageData, index) => {
                                            return new Promise((resolve, reject) => {
                                                const originalDataURL = "data:image/png;base64," + imageData;
                                                createThumbnail(originalDataURL, "PDF图片" + index, index).then(thumbnailDataURL => {
                                                    images.push({
                                                        originalDataURL: originalDataURL,
                                                        translatedDataURL: null,
                                                        bubbleTexts: [],
                                                        bubbleCoords: [],
                                                        thumbnailDataURL: thumbnailDataURL,
                                                        fileName: "PDF图片" + index
                                                    });
                                                      resolve();
                                                }).catch(reject);
                                            });
                                        }))
                                        .then(() => {
                                             if (i === filesArray.length - 1) {
                                                //pdf是最后一张
                                                finishHandleFiles();
                                            }
                                        })

                                } else {
                                     errorMessage.text("PDF中没有图片").show();
                                }

                            },
                            error: function(error) {
                                console.error("上传 PDF 文件失败:", error);
                                errorMessage.text("上传 PDF 文件失败，请检查文件格式或重试").show();
                            }
                        });
                    }
                     else {
                            errorMessage.text("请选择图片或PDF文件").show();
                            return;
                     }

                }

    }
}
// 提取共有代码，处理最后一步图片显示
    function finishHandleFiles() {
        loadingMessage.hide();
        loadingAnimation.hide();
        translateButton.prop('disabled', false);
        translateAllButton.prop('disabled', false);
        sortImagesByName();
        renderThumbnails();
        switchImage(0);
    }

    function sortImagesByName() {
        images.sort((a, b) => {
            if (a.fileName < b.fileName) {
                return -1;
            }
            if (a.fileName > b.fileName) {
                return 1;
            }
            return 0;
        });
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
        updateNavigationButtons();
    }


    function switchImage(index) {
        if (index >= 0 && index < images.length) {
            currentImageIndex = index;
            console.log("switchImage called, index:", index, "currentImageIndex updated to:", currentImageIndex);
            translatedImageDisplay.attr('src', images[index].translatedDataURL || images[index].originalDataURL).show();
            resultSection.toggle(images[index].translatedDataURL !== null);
            downloadButton.toggle(images[index].translatedDataURL !== null);
            downloadAllImagesButton.toggle(images.some(img => img.translatedDataURL !== null)); // 显示/隐藏下载所有图片按钮
            detectedTextInfo.toggle(images[index].bubbleTexts.length > 0 && images[index].translatedDataURL !== null);
            detectedTextList.text(images[index].bubbleTexts.join("\n"));

            $("#thumbnailList li").removeClass('active');
            $("#thumbnailList li").eq(index).addClass('active');

            updateNavigationButtons();
        }
    }

    function updateNavigationButtons() {
        console.log("updateNavigationButtons called, currentImageIndex:", currentImageIndex, "images.length:", images.length);
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
        console.log("prevImageButton clicked, currentImageIndex before:", currentImageIndex);
        if (currentImageIndex > 0) {
            switchImage(currentImageIndex - 1);
        }
    });

    // "下一张" 按钮点击事件
    nextImageButton.click(function() {
        console.log("nextImageButton clicked, currentImageIndex before:", currentImageIndex);
        if (currentImageIndex < images.length - 1) {
            switchImage(currentImageIndex + 1);
        }
    });

    translateButton.click(function() {
        if (currentImageIndex === -1) {
            alert("请先选择要翻译的图片");
            return;
        }

        // 显示 "翻译中..." 提示
        translatingMessage.show();

        loadingMessage.hide();
        loadingAnimation.hide();
        errorMessage.hide();
        resultSection.show();
        downloadButton.hide();
        downloadAllImagesButton.hide(); // 隐藏按钮
        detectedTextInfo.hide();

        const targetLanguage = $("#targetLanguage").val();
        const apiKey = $("#apiKey").val();
        const modelName = $("#modelName").val();
        const fontSize = $("#fontSize").val();
        const modelProvider = $("#modelProvider").val();
        const imageData = images[currentImageIndex].originalDataURL.split(',')[1];
        const fontFamily = $("#fontFamily").val(); // 获取字体路径

        $.ajax({
            type: 'POST',
            url: '/translate_image',
            data: JSON.stringify({
                image: imageData,
                target_language: targetLanguage,
                textDirection: 'vertical',
                fontSize: fontSize,
                model_provider: modelProvider,
                api_key: apiKey,
                model_name: modelName,
                fontFamily: fontFamily // 传递字体路径
            }),
            contentType: 'application/json',
            success: function(response) {
                loadingMessage.hide();
                loadingAnimation.hide();
                images[currentImageIndex].translatedDataURL = 'data:image/png;base64,' + response.translated_image;
                images[currentImageIndex].bubbleTexts = response.bubble_texts || [];
                images[currentImageIndex].bubbleCoords = response.bubble_coords || [];

                switchImage(currentImageIndex);

                // **保存模型信息到后端**
                const data = {
                    modelProvider: modelProvider,
                    modelName: modelName
                };
                $.ajax({
                    url: '/save_model_info',
                    type: 'POST',
                    contentType: 'application/json',
                    data: JSON.stringify(data),
                    success: function() {
                        console.log("模型信息保存成功");
                    },
                    error: function(error) {
                        console.error("模型信息保存失败:", error);
                    }
                });

                // 隐藏 "翻译中..." 提示
                translatingMessage.hide();

            },
            error: function(error) {
                loadingMessage.hide();
                loadingAnimation.hide();
                resultSection.hide();
                downloadButton.hide();
                downloadAllImagesButton.hide(); // 隐藏按钮
                detectedTextInfo.hide();

                console.error('Error:', error);
                if (error.responseJSON && error.responseJSON.error) {
                    errorMessage.text("错误: " + error.responseJSON.error).show();
                } else {
                    errorMessage.text("处理出错，请查看控制台。").show();
                }
                // 隐藏 "翻译中..." 提示
                translatingMessage.hide();
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
        // 显示 "翻译中..." 提示
        translatingMessage.show();

        loadingMessage.hide();
        loadingAnimation.hide();
        errorMessage.hide();
        resultSection.show();
        downloadButton.hide();
        downloadAllImagesButton.hide(); // 隐藏按钮
        detectedTextInfo.hide();
        translateButton.prop('disabled', true);
        translateAllButton.prop('disabled', true);

        const targetLanguage = $("#targetLanguage").val();
        const apiKey = $("#apiKey").val();
        const modelName = $("#modelName").val();
        const fontSize = $("#fontSize").val();
        const modelProvider = $("#modelProvider").val();
        const fontFamily = $("#fontFamily").val(); // 获取字体路径

        Promise.all(images.map((imageData, index) => {
            return new Promise((resolve, reject) => {
                const postData = {
                    image: imageData.originalDataURL.split(',')[1],
                    target_language: targetLanguage,
                    textDirection: 'vertical',
                    fontSize: fontSize,
                    model_provider: modelProvider,
                    api_key: apiKey,
                    model_name: modelName,
                    fontFamily: fontFamily // 传递字体路径
                };

                $.ajax({
                    type: 'POST',
                    url: '/translate_image',
                    data: JSON.stringify(postData),
                    contentType: 'application/json',
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

            // 隐藏 "翻译中..." 提示
            translatingMessage.hide();
        });
    }

    // 下载所有图片按钮点击事件
    downloadAllImagesButton.click(function() {
        // 显示 "下载中..." 提示
        downloadingMessage.show();

        const zip = new JSZip();
        images.forEach(imageData => {
            if (imageData.translatedDataURL) {
                const dataURL = imageData.translatedDataURL;
                const base64Image = dataURL.split(',')[1];
                zip.file(imageData.fileName.replace(/\..+$/, '') + '_translated.png', base64Image, {base64: true});
            }
        });

        zip.generateAsync({type:"blob"})
            .then(function(content) {
                const a = document.createElement('a');
                a.href = URL.createObjectURL(content);
                a.download = "translated_images.zip";
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                // 隐藏 "下载中..." 提示
                downloadingMessage.hide();
            });
    });

    downloadButton.click(function() {
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
    prevImageButton.prop('disabled', true);
    nextImageButton.prop('disabled', true);

    const originalHandleFiles = handleFiles;
    handleFiles = function(files) {
        originalHandleFiles(files);
        translateAllButton.prop('disabled', false);
    };


     // **监听模型型号输入框的 focus 事件**
    modelNameInput.on('focus', function() {
        const selectedProvider = modelProviderSelect.val();
        if (selectedProvider) {
            $.ajax({
                url: '/get_used_models',
                type: 'GET',
                data: { model_provider: selectedProvider },
                dataType: 'json',
                success: function(response) {
                    modelSuggestionsDiv.empty();
                    if (response.models && response.models.length > 0) {
                        const suggestionList = $('<ul></ul>');
                        response.models.forEach(function(model) {
                            const listItem = $('<li></li>').text(model).click(function() {
                                modelNameInput.val(model);
                                modelSuggestionsDiv.empty();
                            });
                            suggestionList.append(listItem);
                        });
                        modelSuggestionsDiv.append(suggestionList);
                    } else {
                        modelSuggestionsDiv.text("没有历史模型");
                    }
                },
                error: function(error) {
                    console.error("获取历史模型失败:", error);
                    modelSuggestionsDiv.text("加载历史模型失败");
                }
            });
        } else {
            modelSuggestionsDiv.empty();
        }
    });

     // **页面加载时，从后端获取模型信息 (移除自动填充)**
    $.ajax({
        url: '/get_model_info',
        type: 'GET',
        dataType: 'json',
        success: function(response) {
            if (response && response.modelProvider) {
                modelProviderSelect.val(response.modelProvider);
                // 移除自动填充: modelNameInput.val(response.modelName);
            }
        },
        error: function(error) {
            console.error("无法从后端获取模型信息:", error);
        }
    });
});
