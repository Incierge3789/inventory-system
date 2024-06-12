import { openDB } from 'idb';

const dbPromise = openDB('inventory-db', 1, {
    upgrade(db) {
        db.createObjectStore('items', { keyPath: 'id', autoIncrement: true });
        db.createObjectStore('nextId', { keyPath: 'id' });
    }
});

new Vue({
    el: '#app',
    data: {
        items: [],
        newItem: { name: '', stock: 0, photo: '' },
        nextId: 1,
        chart: null // チャートのインスタンスを保持
    },
    methods: {
        async addItem() {
            if (this.newItem.name && this.newItem.stock !== '') {
                const newItem = {
                    id: this.nextId++,
                    name: this.newItem.name,
                    stock: parseInt(this.newItem.stock),
                    photo: this.newItem.photo
                };
                this.items.push(newItem);
                this.newItem = { name: '', stock: 0, photo: '' };
                await this.saveData();
                this.checkStockAlert(newItem);
                this.renderChart();
                console.log('Added item:', newItem);
                console.log('Current items:', this.items);
            }
        },
        async removeItem(id) {
            this.items = this.items.filter(item => item.id !== id);
            await this.saveData();
            this.renderChart();
            console.log('Removed item with id:', id);
            console.log('Current items:', this.items);
        },
        async updateItem(item) {
            await this.saveData();
            this.checkStockAlert(item);
            this.renderChart();
            console.log('Updated item:', item);
            console.log('Current items:', this.items);
        },
        onFileChange(e) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = (e) => {
                this.newItem.photo = e.target.result;
                console.log('Loaded photo for new item:', this.newItem.photo);
            };
            reader.readAsDataURL(file);
        },
        checkStockAlert(item) {
            if (item.stock <= 0) {
                alert(`${item.name} の在庫がありません！`);
            }
        },
        renderChart() {
            const ctx = document.getElementById('stockChart').getContext('2d');

            // 既存のチャートがあれば破棄
            if (this.chart) {
                this.chart.destroy();
            }

            this.chart = new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: this.items.map(item => item.name),
                    datasets: [{
                        label: '在庫数',
                        data: this.items.map(item => item.stock),
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            console.log('Rendered chart with items:', this.items);
        },
        async saveData() {
            const db = await dbPromise;
            const tx = db.transaction(['items', 'nextId'], 'readwrite');
            const itemsStore = tx.objectStore('items');
            const nextIdStore = tx.objectStore('nextId');
            await itemsStore.clear();
            for (const item of this.items) {
                await itemsStore.put(item);
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
        }
    },
    async mounted() {
        await this.loadData();
        this.items.forEach(item => {
            this.checkStockAlert(item);
        });
        console.log('Mounted app with items:', this.items);
    }
});
