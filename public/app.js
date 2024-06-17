document.addEventListener('DOMContentLoaded', async function () {
    const dbPromise = idb.openDB('inventory-db', 2, {
        upgrade(db, oldVersion, newVersion, transaction) {
            if (oldVersion < 1) {
                const itemsStore = db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
                db.createObjectStore('nextId', { keyPath: 'id' });
            }
            if (oldVersion < 2) {
                const itemsStore = transaction.objectStore('items');
                itemsStore.createIndex('productId', 'productId', { unique: true });
            }
        }
    });
    document.getElementById('toggleTheme').addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
    }); 

    const app = Vue.createApp({
        data() {
            return {
                items: [],
                newItem: { name: '', stock: 0, photo: '', area: '', shelf: '', location: '' },
                nextId: 1,
                searchQuery: '',
                filterQuery: '',
                sortOrder: 'asc',
                selectedArea: '',
                chart: null,
                message: '',
                messageType: '',
                showGuide: true, // アプリ起動時に説明ガイドを表示する
                showModal: false,
                cameraStream: null,
                previewPhoto: '', // 追加：プレビュー用の変数
                shelves: [], // 追加：棚番号のリスト
                locations: [], // 追加：場所番号のリスト
                showCodes: false, // 追加: QRコードとバーコードの表示フラグ
                showQRCode: true, // 追加: QRコードを表示するフラグ
                currentProductId: null, // 追加: 現在表示している商品のID
                cameras: [],
                selectedCameraIndex: 0
            };
        },
        computed: {
            filteredItems() {
                let items = this.items;
                
                // 検索クエリによるフィルタリング
                if (this.searchQuery) {
                items = items.filter(item => item.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
                }

                // 選択されたエリアによるフィルタリング
                if (this.selectedArea) {
                    items = items.filter(item => item.area === this.selectedArea);
                }

                // フィルタークエリによるフィルタリング
                if (this.filterQuery) {
                    items = items.filter(item => item.name.toLowerCase().includes(this.filterQuery.toLowerCase()));
                }

                // ソート順序の適用
                if (this.sortOrder === 'asc') {
                    items.sort((a, b) => a.stock - b.stock);
                } else {
                    items.sort((a, b) => b.stock - a.stock);
                }

                return items;
            }
                  
        },
        methods: {
            onAreaChange() {
               // エリア選択に基づいて棚番号と場所番号を設定
               if (this.newItem.area === '台倉庫' || this.newItem.area === '機械室' || this.newItem.area === 'カウンター倉庫' || this.newItem.area === '備品庫' || this.newItem.area === '外倉庫') {
                   this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                   this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
               } else {
                   this.shelves = [];
                   this.locations = [];
               }
            },
            addShelf() {
               if (this.newShelf) {
                   this.shelves.push(this.newShelf);
                   this.newShelf = '';
                   this.showMessage('棚番号が追加されました。', 'success');
               } else {
                   this.showMessage('棚番号を入力してください。', 'error');
               }
            },
            addLocation() {
               if (this.newLocation) {
                   this.locations.push(this.newLocation);
                   this.newLocation = '';
                   this.showMessage('場所番号が追加されました。', 'success');
               } else {
                   this.showMessage('場所番号を入力してください。', 'error');
               }
            },
            async addItem() {
                if (this.newItem.name && this.newItem.stock !== '' && this.newItem.area) {
　　　　　　　　　　const productId = this.generateProductId(); // 商品IDを生成
                    const newItem = {
                        id: this.nextId++,
                        productId: productId, // 追加: 商品ID
                        name: this.newItem.name,
                        stock: parseInt(this.newItem.stock),
                        photo: this.newItem.photo,
                        area: this.newItem.area || '',
                        shelf: this.newItem.shelf || '',
                        location: this.newItem.location || ''
                    };
                    this.items.push(newItem);
                    this.newItem = { name: '', stock: 0, photo: '', area: '', shelf: '', location: ''  };
                    this.previewPhoto = ''; // 追加：プレビューをリセット
                    await this.saveData();
                    this.checkStockAlert(newItem);
                    this.renderChart();
                    this.showMessage('部品が追加されました。', 'success');
                    this.currentProductId = productId; // 追加: 現在の商品のIDを設定
                    this.showCodes = true; // 追加: QRコードとバーコードを表示する
                    document.querySelector('#app').classList.add('show-codes'); // クラスを追加
                    console.log('Added item:', newItem);
                    console.log('Current items:', this.items);
                    
                    // QRコードとバーコードを生成
                    console.log('QRコードとバーコードを生成します');
                    this.$nextTick(async () => { // DOM更新後に実行
                        await this.generateQRCodeAndBarcode(productId);
                    });
                } else {
                    this.showMessage('すべてのフィールドを入力してください。', 'error');
                }
            },
            generateProductId() { // 新しいメソッドの追加
                // 商品IDを生成するロジック（例: UUIDを生成）
                return 'product-' + Math.random().toString(36).substr(2, 9);
            },
            async generateQRCodeAndBarcode(productId) {
                // QRコード生成
                this.$nextTick(() => {
                    if (this.showQRCode) {
                        const qrCanvas = document.getElementById('qrCanvas');
                        if (!qrCanvas) {
                            console.error('QRコード用のキャンバスが見つかりません');
                            return;
                        }

                        qrCanvas.width = 200; // 幅を設定
                        qrCanvas.height = 200; // 高さを設定
                        console.log('QRコード用のキャンバスを取得しました:', qrCanvas);

                        QRCode.toCanvas(qrCanvas, productId, (error) => {
                            if (error) {
                                console.error('QRコードの生成中にエラーが発生しました:', error);
                            } else {
                                console.log('QRコード生成完了');
                            }
                        });
                    } else {
                        // バーコード生成
                        const barcodeCanvas = document.getElementById('barcodeCanvas');
                        if (!barcodeCanvas) {
                            console.error('バーコード用のキャンバスが見つかりません');
                            return;
                        }
                        barcodeCanvas.width = 400; // 幅を設定
                        barcodeCanvas.height = 100; // 高さを設定
                        console.log('バーコード用のキャンバスを取得しました:', barcodeCanvas);
                        JsBarcode(barcodeCanvas, productId, {
                            format: "CODE128",
                            displayValue: true
                        }, (error) => {
                            if (error) {
                                console.error('バーコードの生成中にエラーが発生しました:', error);
                            } else {
                                console.log('バーコード生成完了');
                            } 
                        });
                    }
                });
            },
            // QRコードとバーコードの表示を切り替えるメソッド
            toggleQRCodeBarcode() {
                // showQRCode フラグを切り替える
                this.showQRCode = !this.showQRCode;
                // キャンバスの表示を切り替えた後、再度QRコードまたはバーコードを生成
                this.$nextTick(async () => {
                    await this.generateQRCodeAndBarcode(this.currentProductId);
                });
            },
            viewCodes(productId) {
                this.currentProductId = productId;
                this.showCodes = true;
                this.$nextTick(async () => {
                    await this.generateQRCodeAndBarcode(productId);
                });
            },
            closeCodes() {
                this.showCodes = false;
                this.currentProductId = null;
            },
            async lookupProduct(productId) { // 新しいメソッドの追加
                const db = await dbPromise;
                const tx = db.transaction('items', 'readonly');
                const store = tx.objectStore('items');
                const index = store.index('productId'); // 追加: インデックスを使用
                const product = await index.get(productId);

                if (product) {
                    this.newItem = product;
                    this.showMessage(`商品情報が読み込まれました: ${product.name}`, 'success');
                } else {
                    this.showMessage('商品が見つかりませんでした。', 'error');
               }
            },
            async removeItem(id) {
                this.items = this.items.filter(item => item.id !== id);
                await this.saveData();
                this.renderChart();
                this.showMessage('部品が削除されました。', 'success');
                console.log('Removed item with id:', id);
                console.log('Current items:', this.items);
            },
            async updateItem(item) {
                const index = this.items.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    this.items[index].stock = item.stock;
                    this.items[index].area = item.area || '';
                    this.items[index].shelf = item.shelf || '';
                    this.items[index].location = item.location || '';
                    await this.saveData();
                    this.checkStockAlert(item);
                    this.renderChart();
                    this.showMessage('在庫数が更新されました。', 'success');
                    console.log('Updated item:', item);
                    console.log('Current items:', this.items);
                }
            },
            onFileChange(e) {
                const file = e.target.files[0];
                this.handleFile(file);
            },
            handleFile(file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    this.newItem.photo = e.target.result;
                    this.previewPhoto = e.target.result; // 追加：プレビュー用の画像データを設定
                    console.log('Loaded photo for new item:', this.newItem.photo);
                };
                reader.readAsDataURL(file);
            },
            setupDragAndDrop() {
                const dropArea = this.$refs.dropArea;
                dropArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    dropArea.classList.add('dragover');
                });
                dropArea.addEventListener('dragleave', () => {
                    dropArea.classList.remove('dragover');
                });
                dropArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    dropArea.classList.remove('dragover');
                    const file = e.dataTransfer.files[0];
                    this.handleFile(file);
                });
            },
            async openCamera() {
                this.showModal = true;
                await this.getCameras();
                if (this.cameras.length > 0) {
                    this.selectedCameraIndex = 0; // デフォルトで最初のカメラを選択
                    await this.startCamera(this.cameras[this.selectedCameraIndex].deviceId);
                }
            },
            async getCameras() {
                try {
                    const devices = await navigator.mediaDevices.enumerateDevices();
                    this.cameras = devices.filter(device => device.kind === 'videoinput');
                } catch (error) {
                    console.error('Error accessing media devices:', error);
                }
            },
            async startCamera(deviceId) {
                if (this.cameraStream) {
                    this.cameraStream.getTracks().forEach(track => track.stop());
                }
                const constraints = {
                    video: {
                        deviceId: deviceId ? { exact: deviceId } : undefined,
                        width: { ideal: 1280 },
                        height: { ideal: 720 }
                    }
                };
                try {
                    const stream = await navigator.mediaDevices.getUserMedia(constraints);
                    this.cameraStream = stream;
                    const video = this.$refs.video;
                    video.srcObject = stream;
                    video.play();
                    video.onloadedmetadata = () => {
                        const detectionCanvas = this.$refs.detectionCanvas;
                        detectionCanvas.width = video.videoWidth;
                        detectionCanvas.height = video.videoHeight;
                        this.startDetection();
                    };
                } catch (error) {
                    console.error('Error starting camera:', error);
                    alert('カメラの起動に失敗しました。');
                }
            },
            async toggleCamera() {
                if (this.cameras.length > 1) {
                    this.selectedCameraIndex = (this.selectedCameraIndex + 1) % this.cameras.length;
                    const deviceId = this.cameras[this.selectedCameraIndex].deviceId;
                    await this.startCamera(deviceId);
                }
            },
            closeModal() {
                this.showModal = false;
                if (this.cameraStream) {
                    this.cameraStream.getTracks().forEach(track => track.stop());
                    this.cameraStream = null;
                }
                if (this.detectionCanvas) {
                    const context = this.detectionCanvas.getContext('2d');
                    context.clearRect(0, 0, this.detectionCanvas.width, this.detectionCanvas.height);
                }
            },
            capturePhoto() {
                const video = this.$refs.video;
                const canvas = document.createElement('canvas');
                const context = canvas.getContext('2d');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                context.drawImage(video, 0, 0, canvas.width, canvas.height);

                this.newItem.photo = canvas.toDataURL('image/png');
                this.previewPhoto = this.newItem.photo; // 追加：プレビュー用の画像データを設定

                // 物体検知と赤い枠の描画
                this.detectObjectsOnPhoto(canvas);

                this.closeModal();
            },
            async detectObjectsOnPhoto(canvas) {
                const context = canvas.getContext('2d');
                const model = await cocoSsd.load();
                const predictions = await model.detect(canvas);
        
                predictions.forEach(prediction => {
                    const [x, y, width, height] = prediction.bbox;
                    context.beginPath();
                    context.rect(x, y, width, height);
                    context.lineWidth = 2;
                    context.strokeStyle = 'red';
                    context.fillStyle = 'red';
                    context.stroke();
                    context.fillText(
                        `${prediction.class} - ${Math.round(prediction.score * 100)}%`,
                        x,
                        y > 10 ? y - 5 : 10
                    );
                });
        
                // 新しい赤い枠が描かれた写真をプレビュー用の画像データに設定
                this.newItem.photo = canvas.toDataURL('image/png');
                this.previewPhoto = this.newItem.photo;
            },
            async startDetection() {            
                const video = this.$refs.video;
                const detectionCanvas = this.$refs.detectionCanvas;
                const context = detectionCanvas.getContext('2d');

                detectionCanvas.width = video.videoWidth;
                detectionCanvas.height = video.videoHeight;

                const model = await cocoSsd.load();

                const detectFrame = async () => {
                    const predictions = await model.detect(video);
                    context.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
                    console.log('Predictions:', predictions); // デバッグメッセージ
                    
                    predictions.forEach(prediction => {
                        const [x, y, width, height] = prediction.bbox;
                        context.beginPath();
                        context.rect(x, y, width, height);
                        context.lineWidth = 2;
                        context.strokeStyle = 'red';
                        context.fillStyle = 'red';
                        context.stroke();
                        console.log('Drawing box:', prediction.bbox); // デバッグメッセージ
                        context.fillText(
                            `${prediction.class} - ${Math.round(prediction.score * 100)}%`,
                            x,
                            y > 10 ? y - 5 : 10
                        );
                    });
                    console.log('Predictions:', predictions); // 予測結果をコンソールに出力

                    requestAnimationFrame(detectFrame);
                };
                detectFrame();
            },
            searchItems() {
                // computed プロパティが自動的に再評価されるので何もする必要はない
            },
            filterByArea() {
                // computed プロパティが自動的に再評価されるので何もする必要はない
            },
            checkStockAlert(item) {
                if (item.stock <= 0) {
                    alert(`${item.name} の在庫がありません！`);
                }
            },
            sortItems(order) {
                this.sortOrder = order;
            },
            renderChart() {
                // カラーパレットの定義
                const colors = ["#007aff", "#34c759", "#ff3b30", "#ffcc00", "#5856d6"];

                // 各部品の合計在庫数を計算
                const totalStocks = this.filteredItems.reduce((acc, item) => {
                    const key = item.name;
                    if (!acc[key]) {
                        acc[key] = 0;
                    }
                    acc[key] += item.stock;
                    return acc;
                }, {});

                const data = Object.keys(totalStocks).map(name => ({ name, stock: totalStocks[name] }));
                const svg = d3.select("#stockChart");
                if (svg.empty()) {
                    console.error("Element #stockChart not found");
                    return;
                }
                svg.selectAll("*").remove(); // 既存のチャートをクリア
                const margin = { top: 20, right: 30, bottom: 40, left: 40 },
                    width = +svg.attr("width") - margin.left - margin.right,
                    height = +svg.attr("height") - margin.top - margin.bottom;
                const x = d3.scaleBand().rangeRound([0, width]).padding(0.1),
                    y = d3.scaleLinear().rangeRound([height, 0]);
                const g = svg.append("g")
                    .attr("transform", `translate(${margin.left},${margin.top})`);
                x.domain(data.map(d => d.name));
                y.domain([0, d3.max(data, d => d.stock)]);
    
                g.append("g")
                    .attr("class", "axis axis--x")
                    .attr("transform", `translate(0,${height})`)
                    .call(d3.axisBottom(x));
                g.append("g")
                    .attr("class", "axis axis--y")
                    .call(d3.axisLeft(y).ticks(10))
                    .append("text")
                    .attr("class", "axis-title")
                    .attr("transform", "rotate(-90)")
                    .attr("y", 6)
                    .attr("dy", "0.71em")
                    .attr("text-anchor", "end")
                    .text("在庫数");
    
                const bars = g.selectAll(".bar")
                    .data(data);

                bars.enter().append("rect")
                    .attr("class", "bar")
                    .attr("x", d => x(d.name))
                    .attr("y", height)
                    .attr("width", x.bandwidth())
                    .attr("height", 0)
                    .attr("fill", (d, i) => colors[i % colors.length])  // ここでカラーパレットを使用
                    .merge(bars)
                    .transition()
                    .duration(750)
                    .attr("x", d => x(d.name))
                    .attr("y", d => y(d.stock))
                    .attr("width", x.bandwidth())
                    .attr("height", d => Math.max(0, height - y(d.stock)));

                bars.exit().remove();
                
                // ツールチップの追加
                const tooltip = d3.select("#tooltip");
                bars.on("mouseover", (event, d) => {
                    tooltip.style("display", "block")
                        .html(`部品名: ${d.name}<br>在庫数: ${d.stock}`)
                        .style("left", `${event.pageX + 5}px`)
                        .style("top", `${event.pageY - 28}px`);
                }).on("mouseout", () => {
                    tooltip.style("display", "none");
                });

                // 詳細情報の表示
                const itemDetails = document.getElementById('itemDetails');
                itemDetails.innerHTML = ''; // 既存の内容をクリア
                this.filteredItems.forEach(item => {
                    const detailDiv = document.createElement('div');
                    detailDiv.classList.add('item-detail');
                    detailDiv.innerHTML = `<strong>${item.name}</strong>: ${item.stock} (エリア: ${item.area}, 棚: ${item.shelf}, 場所: ${item.location})`;
                    itemDetails.appendChild(detailDiv);
                });
            },
            showMessage(message, type) {
                const messageBox = document.getElementById('feedbackMessage');
                messageBox.className = type;
                messageBox.textContent = message;
                messageBox.classList.remove('hidden');
                setTimeout(() => {
                    messageBox.classList.add('hidden');
                }, 3000);
            },
            async saveData() {
                const db = await dbPromise;
                const tx = db.transaction(['items', 'nextId'], 'readwrite');
                const itemsStore = tx.objectStore('items');
                const nextIdStore = tx.objectStore('nextId');
                await itemsStore.clear();
                for (const item of this.items) {
                    // プロキシを取り除くためにオブジェクトをシリアライズしてデシリアライズする
                    await itemsStore.put(JSON.parse(JSON.stringify(item)));
                }
                await nextIdStore.put({ id: 1, nextId: this.nextId });
                await tx.done;
                console.log('Saved data to IndexedDB:', this.items, this.nextId);
            },
            async loadData() {
                const db = await dbPromise;
                const items = await db.getAll('items');
                const nextIdEntry = await db.get('nextId', 1);
                this.items = items || [];
                this.nextId = (nextIdEntry && nextIdEntry.nextId) || 1;
                console.log('Loaded data from IndexedDB:', this.items, this.nextId);
                this.renderChart();
            },
            nextGuideStep() {
                // ガイドの次のステップに進むロジックをここに追加
                this.showGuide = false; // 一時的にガイドを非表示にする例
            },
            closeGuide() {
                this.showGuide = false; // ガイドを完全に閉じる
            },
            updateShelves() {
                // エリアに基づいて棚番号を更新
                if (this.selectedArea === '台倉庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                } else if (this.selectedArea === '機械室') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                } else if (this.selectedArea === 'カウンター倉庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                } else if (this.selectedArea === '備品庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
　　　　　　　　 } else if (this.selectedArea === '外倉庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                } else {
                    this.shelves = [];
                }
                this.selectedShelf = '';
                this.locations = [];
            },
            updateLocations() {
                // 棚番号に基づいて場所番号を更新
                if (this.selectedShelf === '棚A') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚B') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚C') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚D') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚E') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚F') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚G') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚H') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚I') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.selectedShelf === '棚J') {
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else {
                    this.locations = [];
                }
                this.selectedLocation = '';
            },
            async callHelloFunction() {
                try {
                    const response = await fetch('/.netlify/functions/hello');
                    const data = await response.json();
                    console.log(data.message); // "Hello, World!" と表示されるはずです
                } catch (error) {
                    console.error('Error calling hello function:', error);
                }
            }
        },
        async mounted() {
            await this.loadData();
            this.items.forEach(item => {
                this.checkStockAlert(item);
            });
            console.log('Mounted app with items:', this.items);
            this.setupDragAndDrop();

            // エリア選択変更時のリスナーを追加
            this.$watch('newItem.area', this.onAreaChange);

            // 初期データをロード
            this.updateShelves();
            this.updateLocations();

            // 関数呼び出し
            await this.callHelloFunction();
            // カメラ
            await this.getCameras();
        },
        });

        app.mount('#app');
        });
