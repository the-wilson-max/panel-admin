// Variables globales (se llenarán con los datos de los CSV)
let productosConvencional = [];
let productosOrganico = [];
let movimientos = [];
let productos = [];
let alertas = [];

// Inicializar la aplicación
document.addEventListener('DOMContentLoaded', async function() {
    await inicializarDatos();
    inicializarEventListeners();
    cargarInventario();
    actualizarDashboard();
});

async function inicializarDatos() {
    // Cargar datos desde archivos CSV
    try {
        // Cargar productos convencionales
        productosConvencional = await cargarCSV('data/productos_convencional.csv', 'convencional');
        
        // Cargar productos orgánicos  
        productosOrganico = await cargarCSV('data/productos_organico.csv', 'organico');
        
        // Combinar todos los productos
        productos = [
            ...productosConvencional.map(p => ({ ...p, almacen: 'convencional', categoria: p.categoria || 'herbicida' })),
            ...productosOrganico.map(p => ({ ...p, almacen: 'organico', categoria: p.categoria || 'organico' }))
        ];

        // Establecer fecha actual en los formularios
        const now = new Date();
        const fechaStr = now.toISOString().slice(0, 16);
        document.getElementById('fecha').value = fechaStr;
        document.getElementById('fechaMultiple').value = fechaStr;

        // Cargar movimientos desde localStorage si existen
        const movimientosGuardados = localStorage.getItem('movimientos');
        if (movimientosGuardados) {
            movimientos = JSON.parse(movimientosGuardados);
        }

        // Cargar alertas desde localStorage si existen
        const alertasGuardadas = localStorage.getItem('alertas');
        if (alertasGuardadas) {
            alertas = JSON.parse(alertasGuardadas);
            actualizarContadorAlertas();
        }

    } catch (error) {
        console.error('Error inicializando datos:', error);
        alert('Error cargando los datos iniciales. Por favor, verifica que los archivos CSV existan.');
    }
}

// Función para cargar y parsear un archivo CSV
async function cargarCSV(url, tipoAlmacen) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`No se pudo cargar el CSV: ${response.statusText}`);
        }
        const csvText = await response.text();
        
        return new Promise((resolve, reject) => {
            Papa.parse(csvText, {
                header: true,
                dynamicTyping: true,
                skipEmptyLines: true,
                complete: function(results) {
                    // Agregar el tipo de almacén a cada producto
                    const productosConTipo = results.data.map(producto => ({
                        ...producto,
                        almacen: tipoAlmacen
                    }));
                    resolve(productosConTipo);
                },
                error: function(error) {
                    reject(error);
                }
            });
        });
    } catch (error) {
        console.error('Error cargando el CSV:', error);
        return [];
    }
}

function inicializarEventListeners() {
    // Navegación del sidebar
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            
            // Actualizar clase activa
            document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
            this.classList.add('active');
            
            // Mostrar sección correspondiente
            document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
            document.getElementById(sectionId).classList.add('active');
        });
    });

    // Modal de movimiento único
    const modalMovimiento = document.getElementById('modalMovimiento');
    modalMovimiento.addEventListener('show.bs.modal', function (event) {
        const button = event.relatedTarget;
        const tipo = button.getAttribute('data-tipo');
        document.getElementById('movimientoTipoAlmacen').value = tipo;
        cargarProductosEnSelect('selectProducto', tipo);
    });

    // Modal de múltiples movimientos
    const modalMovimientoMultiple = document.getElementById('modalMovimientoMultiple');
    modalMovimientoMultiple.addEventListener('show.bs.modal', function (event) {
        const button = event.relatedTarget;
        const tipo = button.getAttribute('data-tipo');
        document.getElementById('movimientoMultipleTipoAlmacen').value = tipo;
        
        // Cargar productos en el primer select
        const firstSelect = document.querySelector('.select-producto-multiple');
        cargarProductosEnSelect(firstSelect, tipo);
    });

    // Guardar movimiento único
    document.getElementById('btnGuardarMovimiento').addEventListener('click', function() {
        guardarMovimiento();
    });

    // Guardar múltiples movimientos
    document.getElementById('btnGuardarMovimientoMultiple').addEventListener('click', function() {
        guardarMovimientosMultiples();
    });

    // Guardar producto
    document.getElementById('btnGuardarProducto').addEventListener('click', function() {
        guardarProducto();
    });

    // Importar CSV convencional
    document.getElementById('btnImportConvencional').addEventListener('click', function() {
        document.getElementById('fileInput').setAttribute('data-tipo', 'convencional');
        document.getElementById('fileInput').click();
    });

    // Importar CSV orgánico
    document.getElementById('btnImportOrganico').addEventListener('click', function() {
        document.getElementById('fileInput').setAttribute('data-tipo', 'organico');
        document.getElementById('fileInput').click();
    });

    // Búsqueda en inventario convencional
    document.getElementById('btnSearchConvencional').addEventListener('click', function() {
        buscarEnInventario('convencional');
    });

    // Búsqueda en inventario orgánico
    document.getElementById('btnSearchOrganico').addEventListener('click', function() {
        buscarEnInventario('organico');
    });

    // Búsqueda en movimientos
    document.getElementById('btnSearchMovimientos').addEventListener('click', function() {
        buscarMovimientos();
    });

    // Búsqueda en productos
    document.getElementById('btnSearchProductos').addEventListener('click', function() {
        buscarProductos();
    });

    // Configurar drop zone
    const dropZone = document.getElementById('dropZone');
    dropZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.style.backgroundColor = '#e9e9e9';
    });
    dropZone.addEventListener('dragleave', function() {
        this.style.backgroundColor = '#f9f9f9';
    });
    dropZone.addEventListener('drop', function(e) {
        e.preventDefault();
        this.style.backgroundColor = '#f9f9f9';
        if (e.dataTransfer.files.length) {
            handleFileSelect(e.dataTransfer.files);
        }
    });
}

function cargarInventario() {
    // Cargar inventario convencional
    const tbodyConvencional = document.getElementById('tbodyConvencional');
    tbodyConvencional.innerHTML = '';
        
    productosConvencional.forEach(producto => {
        const estado = calcularEstadoStock(producto.stock, producto.stockMin, producto.stockMax);
        const estadoClass = estado === 'Bajo' ? 'stock-low' : (estado === 'Agotado' ? 'stock-zero' : 'stock-ok');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.nombre}</td>
            <td>${producto.unidad}</td>
            <td>${producto.ingrediente}</td>
            <td class="${estadoClass}">${producto.stock}</td>
            <td>${producto.stockMin}</td>
            <td>${producto.stockMax}</td>
            <td><span class="badge bg-${estado === 'OK' ? 'success' : (estado === 'Bajo' ? 'warning' : 'danger')}">${estado}</span></td>
            <td>
                <button class="btn btn-sm btn-info"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-warning"><i class="fas fa-edit"></i></button>
            </td>
        `;
        tbodyConvencional.appendChild(tr);
    });
    
    document.getElementById('loadingConvencional').style.display = 'none';
    
    // Cargar inventario orgánico
    const tbodyOrganico = document.getElementById('tbodyOrganico');
    tbodyOrganico.innerHTML = '';
    
    productosOrganico.forEach(producto => {
        const estado = calcularEstadoStock(producto.stockFinal, producto.stockMin, producto.stockMax);
        const estadoClass = estado === 'Bajo' ? 'stock-low' : (estado === 'Agotado' ? 'stock-zero' : 'stock-ok');
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${producto.codigo}</td>
            <td>${producto.nombre}</td>
            <td>${producto.unidad}</td>
            <td>${producto.ingrediente}</td>
            <td>${producto.stock}</td>
            <td>${producto.stockMin}</td>
            <td>${producto.stockMax}</td>
            <td>${producto.diferencias}</td>
            <td class="${estadoClass}">${producto.stockFinal}</td>
            <td><span class="badge bg-${estado === 'OK' ? 'success' : (estado === 'Bajo' ? 'warning' : 'danger')}">${estado}</span></td>
            <td>
                <button class="btn btn-sm btn-info"><i class="fas fa-eye"></i></button>
                <button class="btn btn-sm btn-warning"><i class="fas fa-edit"></i></button>
            </td>
        `;
        tbodyOrganico.appendChild(tr);
    });
    
    document.getElementById('loadingOrganico').style.display = 'none';
}

function calcularEstadoStock(stock, stockMin, stockMax) {
    if (stock <= 0) return 'Agotado';
    if (stock < stockMin) return 'Bajo';
    if (stock > stockMax) return 'Exceso';
    return 'OK';
}

function cargarProductosEnSelect(selectElement, tipoAlmacen) {
    // Limpiar opciones actuales
    selectElement.innerHTML = '<option value="">Seleccione un producto</option>';
    
    // Filtrar productos por tipo de almacén
    const productosFiltrados = productos.filter(p => p.almacen === tipoAlmacen);
    
    // Agregar opciones al select
    productosFiltrados.forEach(producto => {
        const option = document.createElement('option');
        option.value = producto.codigo;
        option.textContent = `${producto.codigo} - ${producto.nombre}`;
        option.setAttribute('data-stock', producto.stock);
        selectElement.appendChild(option);
    });
}

function guardarMovimiento() {
    const tipoAlmacen = document.getElementById('movimientoTipoAlmacen').value;
    const tipoMovimiento = document.getElementById('tipoMovimiento').value;
    const codigoProducto = document.getElementById('selectProducto').value;
    const cantidad = parseFloat(document.getElementById('cantidad').value);
    const fecha = document.getElementById('fecha').value;
    const comentario = document.getElementById('comentario').value;
    
    if (!codigoProducto || isNaN(cantidad) || !fecha) {
        alert('Por favor, complete todos los campos obligatorios.');
        return;
    }
    
    // Encontrar el producto
    const productoIndex = productos.findIndex(p => p.codigo === codigoProducto && p.almacen === tipoAlmacen);
    if (productoIndex === -1) {
        alert('Producto no encontrado.');
        return;
    }
    
    // Actualizar stock según el tipo de movimiento
    if (tipoMovimiento === 'entrada') {
        productos[productoIndex].stock += cantidad;
    } else if (tipoMovimiento === 'salida') {
        if (productos[productoIndex].stock < cantidad) {
            alert('No hay suficiente stock para realizar esta salida.');
            return;
        }
        productos[productoIndex].stock -= cantidad;
    } else if (tipoMovimiento === 'ajuste') {
        productos[productoIndex].stock = cantidad;
    }
    
    // Registrar el movimiento
    const movimiento = {
        id: Date.now(),
        fecha: new Date(fecha),
        tipo: tipoMovimiento,
        almacen: tipoAlmacen,
        codigoProducto: codigoProducto,
        cantidad: cantidad,
        usuario: 'Usuario Actual',
        comentario: comentario
    };
    
    movimientos.push(movimiento);
    localStorage.setItem('movimientos', JSON.stringify(movimientos));
    
    // Verificar alertas de stock
    verificarAlertasStock();
    
    // Actualizar la interfaz
    cargarInventario();
    actualizarDashboard();
    
    // Cerrar modal y resetear formulario
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalMovimiento'));
    modal.hide();
    document.getElementById('formMovimiento').reset();
    
    alert('Movimiento registrado correctamente.');
}

function addMovementRow() {
    const tabla = document.getElementById('tablaMovimientosMultiple');
    const newRow = tabla.insertRow();
    const tipoAlmacen = document.getElementById('movimientoMultipleTipoAlmacen').value;
    
    newRow.innerHTML = `
        <td>
            <select class="form-select select-producto-multiple" required>
                <option value="">Seleccione un producto</option>
            </select>
        </td>
        <td>
            <input type="number" step="0.001" class="form-control" required>
        </td>
        <td>
            <button type="button" class="btn btn-danger btn-sm" onclick="removeMovementRow(this)">
                <i class="fas fa-trash"></i>
            </button>
        </td>
    `;
    
    // Cargar productos en el nuevo select
    const select = newRow.querySelector('.select-producto-multiple');
    cargarProductosEnSelect(select, tipoAlmacen);
}

function removeMovementRow(button) {
    const row = button.closest('tr');
    // No permitir eliminar la última fila
    if (document.getElementById('tablaMovimientosMultiple').rows.length > 1) {
        row.remove();
    }
}

function guardarMovimientosMultiples() {
    const tipoAlmacen = document.getElementById('movimientoMultipleTipoAlmacen').value;
    const tipoMovimiento = document.getElementById('tipoMovimientoMultiple').value;
    const fecha = document.getElementById('fechaMultiple').value;
    const comentarioGeneral = document.getElementById('comentarioMultiple').value;
    
    const rows = document.getElementById('tablaMovimientosMultiple').querySelectorAll('tbody tr');
    let movimientosGuardados = 0;
    
    rows.forEach(row => {
        const select = row.querySelector('.select-producto-multiple');
        const input = row.querySelector('input[type="number"]');
        
        const codigoProducto = select.value;
        const cantidad = parseFloat(input.value);
        
        if (!codigoProducto || isNaN(cantidad)) {
            return; // Saltar filas incompletas
        }
        
        // Encontrar el producto
        const productoIndex = productos.findIndex(p => p.codigo === codigoProducto && p.almacen === tipoAlmacen);
        if (productoIndex === -1) {
            return;
        }
        
        // Actualizar stock según el tipo de movimiento
        if (tipoMovimiento === 'entrada') {
            productos[productoIndex].stock += cantidad;
        } else if (tipoMovimiento === 'salida') {
            if (productos[productoIndex].stock < cantidad) {
                alert(`No hay suficiente stock para realizar la salida del producto ${codigoProducto}.`);
                return;
            }
            productos[productoIndex].stock -= cantidad;
        } else if (tipoMovimiento === 'ajuste') {
            productos[productoIndex].stock = cantidad;
        }
        
        // Registrar el movimiento
        const movimiento = {
            id: Date.now() + movimientosGuardados,
            fecha: new Date(fecha),
            tipo: tipoMovimiento,
            almacen: tipoAlmacen,
            codigoProducto: codigoProducto,
            cantidad: cantidad,
            usuario: 'Usuario Actual',
            comentario: comentarioGeneral
        };
        
        movimientos.push(movimiento);
        movimientosGuardados++;
    });
    
    if (movimientosGuardados > 0) {
        localStorage.setItem('movimientos', JSON.stringify(movimientos));
        
        // Verificar alertas de stock
        verificarAlertasStock();
        
        // Actualizar la interfaz
        cargarInventario();
        actualizarDashboard();
        
        // Cerrar modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalMovimientoMultiple'));
        modal.hide();
        
        alert(`${movimientosGuardados} movimientos registrados correctamente.`);
    } else {
        alert('No se registraron movimientos. Verifique que todos los campos estén completos.');
    }
}

function guardarProducto() {
    const id = document.getElementById('productoId').value;
    const codigo = document.getElementById('codigoProducto').value;
    const nombre = document.getElementById('nombreProducto').value;
    const categoria = document.getElementById('categoriaProducto').value;
    const unidad = document.getElementById('unidadProducto').value;
    const almacen = document.getElementById('almacenProducto').value;
    const ingrediente = document.getElementById('ingredienteProducto').value;
    const stockMin = parseFloat(document.getElementById('stockMinProducto').value);
    const stockMax = parseFloat(document.getElementById('stockMaxProducto').value);
    const stockInicial = parseFloat(document.getElementById('stockInicialProducto').value);
    const proveedor = document.getElementById('proveedorProducto').value;
    const descripcion = document.getElementById('descripcionProducto').value;
    
    if (!codigo || !nombre || !categoria || !unidad || !almacen || isNaN(stockMin) || isNaN(stockMax) || isNaN(stockInicial)) {
        alert('Por favor, complete todos los campos obligatorios.');
        return;
    }
    
    const producto = {
        codigo,
        nombre,
        categoria,
        unidad,
        almacen,
        ingrediente,
        stock: stockInicial,
        stockMin,
        stockMax,
        proveedor,
        descripcion
    };
    
    if (id) {
        // Editar producto existente
        const index = productos.findIndex(p => p.codigo === id && p.almacen === almacen);
        if (index !== -1) {
            productos[index] = { ...productos[index], ...producto };
        }
    } else {
        // Verificar si el código ya existe en el mismo almacén
        if (productos.some(p => p.codigo === codigo && p.almacen === almacen)) {
            alert('Ya existe un producto con este código en el almacén seleccionado.');
            return;
        }
        
        // Agregar nuevo producto
        productos.push(producto);
    }
    
    // Guardar en localStorage
    localStorage.setItem('productos', JSON.stringify(productos));
    
    // Actualizar la interfaz
    cargarInventario();
    actualizarDashboard();
    
    // Cerrar modal
    const modal = bootstrap.Modal.getInstance(document.getElementById('modalProducto'));
    modal.hide();
    
    alert('Producto guardado correctamente.');
}

function verificarAlertasStock() {
    alertas = [];
    
    productos.forEach(producto => {
        const estado = calcularEstadoStock(producto.stock, producto.stockMin, producto.stockMax);
        
        if (estado === 'Agotado') {
            alertas.push({
                tipo: 'stock-cero',
                mensaje: `El producto ${producto.codigo} - ${producto.nombre} está agotado.`,
                fecha: new Date(),
                leida: false
            });
        } else if (estado === 'Bajo') {
            alertas.push({
                tipo: 'stock-bajo',
                mensaje: `El producto ${producto.codigo} - ${producto.nombre} tiene stock bajo (${producto.stock} ${producto.unidad}).`,
                fecha: new Date(),
                leida: false
            });
        }
    });
    
    localStorage.setItem('alertas', JSON.stringify(alertas));
    actualizarContadorAlertas();
}

function actualizarContadorAlertas() {
    const alertasNoLeidas = alertas.filter(a => !a.leida).length;
    document.getElementById('alertCount').textContent = alertasNoLeidas;
}

function actualizarDashboard() {
    // Actualizar contadores
    document.getElementById('totalProductos').textContent = productos.length;
    
    const totalStock = productos.reduce((sum, p) => sum + p.stock, 0);
    document.getElementById('totalStock').textContent = totalStock.toFixed(2);
    
    const stockBajoCount = productos.filter(p => p.stock > 0 && p.stock < p.stockMin).length;
    document.getElementById('stockBajo').textContent = stockBajoCount;
    
    const stockCeroCount = productos.filter(p => p.stock <= 0).length;
    document.getElementById('stockCero').textContent = stockCeroCount;
    
    // Actualizar gráficos
    actualizarGraficos();
    
    // Actualizar alertas en el dashboard
    const alertasDashboard = document.getElementById('alertasDashboard');
    alertasDashboard.innerHTML = '';
    
    const alertasRecientes = alertas.slice(0, 5);
    
    if (alertasRecientes.length === 0) {
        alertasDashboard.innerHTML = '<p class="text-center">No hay alertas en este momento</p>';
    } else {
        alertasRecientes.forEach(alerta => {
            const alertDiv = document.createElement('div');
            alertDiv.className = `alert-stock ${alerta.tipo === 'stock-cero' ? 'bg-danger text-white' : 'bg-warning'}`;
            alertDiv.innerHTML = `
                <div class="d-flex justify-content-between">
                    <span>${alerta.mensaje}</span>
                    <small>${new Date(alerta.fecha).toLocaleDateString()}</small>
                </div>
            `;
            alertasDashboard.appendChild(alertDiv);
        });
    }
}

function actualizarGraficos() {
    // Gráfico de distribución por categoría
    const categorias = {};
    productos.forEach(p => {
        if (!categorias[p.categoria]) {
            categorias[p.categoria] = 0;
        }
        categorias[p.categoria] += p.stock;
    });
    
    const categoriaCtx = document.getElementById('categoriaChart').getContext('2d');
    new Chart(categoriaCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(categorias),
            datasets: [{
                data: Object.values(categorias),
                backgroundColor: ['#3498db', '#2ecc71', '#e74c3c', '#f39c12', '#9b59b6', '#1abc9c', '#34495e']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
    
    // Gráfico de movimientos mensuales (ejemplo)
    const movimientosCtx = document.getElementById('movimientosChart').getContext('2d');
    new Chart(movimientosCtx, {
        type: 'bar',
        data: {
            labels: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'],
            datasets: [{
                label: 'Entradas',
                data: [12, 19, 8, 15, 14, 16],
                backgroundColor: '#2ecc71'
            }, {
                label: 'Salidas',
                data: [8, 12, 6, 9, 11, 13],
                backgroundColor: '#e74c3c'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

function buscarEnInventario(tipo) {
    const searchTerm = tipo === 'convencional' 
        ? document.getElementById('searchConvencional').value.toLowerCase()
        : document.getElementById('searchOrganico').value.toLowerCase();
    
    const tbody = tipo === 'convencional' 
        ? document.getElementById('tbodyConvencional')
        : document.getElementById('tbodyOrganico');
    
    const rows = tbody.getElementsByTagName('tr');
    
    for (let i = 0; i < rows.length; i++) {
        const cells = rows[i].getElementsByTagName('td');
        let found = false;
        
        for (let j = 0; j < cells.length; j++) {
            if (cells[j].textContent.toLowerCase().includes(searchTerm)) {
                found = true;
                break;
            }
        }
        
        rows[i].style.display = found ? '' : 'none';
    }
}

function buscarMovimientos() {
    // Implementar búsqueda en movimientos
    console.log('Búsqueda en movimientos');
}

function buscarProductos() {
    // Implementar búsqueda en productos
    console.log('Búsqueda en productos');
}

function exportToCSV(tipo) {
    let csvContent = "data:text/csv;charset=utf-8,";
    let headers = [];
    let data = [];
    
    if (tipo === 'convencional') {
        headers = ["CÓDIGO", "PRODUCTO", "U/M", "INGREDIENTE ACTIVO", "STOCK", "STOCK MÍN", "STOCK MÁX"];
        data = productosConvencional.map(p => [
            p.codigo, p.nombre, p.unidad, p.ingrediente, p.stock, p.stockMin, p.stockMax
        ]);
    } else {
        headers = ["CÓDIGO", "PRODUCTO", "U/M", "INGREDIENTE ACTIVO", "STOCK", "DIFERENCIAS", "STOCK FINAL", "STOCK MÍN", "STOCK MÁX"];
        data = productosOrganico.map(p => [
            p.codigo, p.nombre, p.unidad, p.ingrediente, p.stock, p.diferencias, p.stockFinal, p.stockMin, p.stockMax
        ]);
    }
    
    csvContent += headers.join(",") + "\n";
    data.forEach(row => {
        csvContent += row.join(",") + "\n";
    });
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventario_${tipo}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function handleFileSelect(files) {
    const file = files[0];
    if (!file) return;
    
    const tipo = document.getElementById('fileInput').getAttribute('data-tipo');
    const reader = new FileReader();
    
    reader.onload = function(e) {
        const content = e.target.result;
        
        if (file.name.endsWith('.csv')) {
            // Procesar CSV
            Papa.parse(content, {
                header: true,
                skipEmptyLines: true,
                complete: function(results) {
                    importarCSV(results.data, tipo);
                }
            });
        } else if (file.name.endsWith('.json')) {
            // Procesar JSON (respaldo)
            try {
                const data = JSON.parse(content);
                restaurarRespaldo(data);
            } catch (error) {
                alert('Error al procesar el archivo de respaldo: ' + error.message);
            }
        }
    };
    
    reader.readAsText(file);
}

function importarCSV(data, tipo) {
    // Implementar importación de CSV según el formato esperado
    alert(`Se importaron ${data.length} registros para el almacén ${tipo}`);
    // Aquí iría la lógica para actualizar el inventario con los datos del CSV
}

function createBackup() {
    const backupData = {
        productos: productos,
        movimientos: movimientos,
        alertas: alertas,
        fecha: new Date()
    };
    
    const dataStr = JSON.stringify(backupData);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `respaldo_inventario_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
}

function restaurarRespaldo(data) {
    if (confirm('¿Está seguro de que desea restaurar el respaldo? Se sobrescribirán todos los datos actuales.')) {
        if (data.productos) productos = data.productos;
        if (data.movimientos) movimientos = data.movimientos;
        if (data.alertas) alertas = data.alertas;
        
        localStorage.setItem('productos', JSON.stringify(productos));
        localStorage.setItem('movimientos', JSON.stringify(movimientos));
        localStorage.setItem('alertas', JSON.stringify(alertas));
        
        cargarInventario();
        actualizarDashboard();
        
        alert('Respaldo restaurado correctamente.');
    }
}

function generateReport() {
    // Implementar generación de reportes
    alert('Generando reporte...');
}

function markAllAlertsAsRead() {
    alertas.forEach(a => a.leida = true);
    localStorage.setItem('alertas', JSON.stringify(alertas));
    actualizarContadorAlertas();
    alert('Todas las alertas marcadas como leídas.');
}

function saveConfig() {
    // Implementar guardado de configuración
    alert('Configuración guardada correctamente.');
}