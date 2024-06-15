document.addEventListener('DOMContentLoaded', async function () {
    const dbPromise = idb.openDB('inventory-db', 1, {
        upgrade(db) {
            db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
            db.createObjectStore('nextId', { keyPath: 'id' });
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
                selectedArea: '',
                chart: null,
                message: '',
                messageType: '',
                showGuide: true, // アプリ起動時に説明ガイドを表示する
                showModal: false,
                cameraStream: null,
                previewPhoto: '', // 追加：プレビュー用の変数
                shelves: [], // 追加：棚番号のリスト
                locations: [] // 追加：場所番号のリスト
            };
        },
        computed: {
            filteredItems() {
                let items = this.items;
                if (this.searchQuery) {
                    items = items.filter(item => item.name.toLowerCase().includes(this.searchQuery.toLowerCase()));
                }
                if (this.selectedArea) {
                    items = items.filter(item => item.area === this.selectedArea);
                }
                return items;
            }
        },
        methods: {
            onAreaChange() {
                // エリア選択に基づいて棚番号と場所番号を設定
                if (this.newItem.area === '台倉庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.newItem.area === '機械室') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.newItem.area === 'カウンター倉庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
                } else if (this.newItem.area === '備品庫') {
                    this.shelves = ['棚A', '棚B', '棚C', '棚D', '棚E', '棚F', '棚G', '棚H', '棚I', '棚J'];
                    this.locations = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
　　　　　　　　 } else if (this.newItem.area === '外倉庫') {
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
                    const newItem = {
                        id: this.nextId++,
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
                    console.log('Added item:', newItem);
                    console.log('Current items:', this.items);
                } else {
                    this.showMessage('すべてのフィールドを入力してください。', 'error');
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
            openCamera() {
                this.showModal = true;
                navigator.mediaDevices.getUserMedia({ video: true })
                    .then((stream) => {
                        this.cameraStream = stream;
                        const video = this.$refs.video;
                        video.srcObject = stream;
                        video.play();
                        this.startDetection();
                    })
                    .catch((err) => {
                        console.error('Error accessing the camera:', err);
                    });
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
                this.previewPhoto = canvas.toDataURL('image/png'); // 追加：プレビュー用の画像データを設定
                console.log('Captured photo for new item:', this.newItem.photo);
                this.closeModal();
            },
            startDetection() {
                const video = this.$refs.video;
                const detectionCanvas = this.$refs.detectionCanvas;
                const context = detectionCanvas.getContext('2d');

                detectionCanvas.width = video.videoWidth;
                detectionCanvas.height = video.videoHeight;

                const detectObjects = () => {
                    context.clearRect(0, 0, detectionCanvas.width, detectionCanvas.height);
                    context.strokeStyle = 'red';
                    context.lineWidth = 2;
                    context.strokeRect(100, 100, 200, 200);
                    requestAnimationFrame(detectObjects);
                };

                detectObjects();
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
            renderChart() {
                const data = this.filteredItems.map(item => ({ name: item.name, stock: item.stock }));
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
                g.selectAll(".bar")
                    .data(data)
                    .enter().append("rect")
                    .attr("class", "bar")
                    .attr("x", d => x(d.name))
                    .attr("y", d => y(d.stock))
                    .attr("width", x.bandwidth())
                    .attr("height", d => height - y(d.stock));
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
            addShelf() {
                if (this.newShelf && !this.shelves.includes(this.newShelf)) {
                    this.shelves.push(this.newShelf);
                    this.newShelf = '';
                } else {
                    alert('棚番号を入力するか、既に存在する棚番号です。');
                }
            },
            addLocation() {
                if (this.newLocation && !this.locations.includes(this.newLocation)) {
                    this.locations.push(this.newLocation);
                    this.newLocation = '';
                } else {
                    alert('場所番号を入力するか、既に存在する場所番号です。');
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
            },
            async callHelloFunction() {
                try {
                    const response = await fetch('/.netlify/functions/hello');
                    const data = await response.json();
                    console.log(data.message); // "Hello, World!" と表示されるはずです
                } catch (error) {
                   console.error('Error calling hello function:', error);
                }
            },
            });

            app.mount('#app');
