// Interfaz: render del DOM y notificaciones con Toastify y SweetAlert2.

const formateadorPrecio = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const UMBRAL_ULTIMAS_UNIDADES = 3;

const formatearPrecio = (valor) => formateadorPrecio.format(valor);

const formatearFecha = (fechaIso) =>
  new Date(fechaIso).toLocaleString("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  });

// Evita que el texto ingresado por el usuario se interprete como HTML.
function escaparHtml(texto) {
  const nodo = document.createElement("div");
  nodo.textContent = texto;
  return nodo.innerHTML;
}

// ---------- Librerías: Toastify y SweetAlert2 ----------

function notificar(texto, tipo = "ok") {
  Toastify({
    text: texto,
    duration: 2800,
    gravity: "top",
    position: "right",
    close: true,
    className: tipo === "error" ? "toast toast-error" : "toast toast-ok",
  }).showToast();
}

const estilosModal = {
  buttonsStyling: false,
  customClass: {
    popup: "modal",
    confirmButton: "btn",
    cancelButton: "btn btn-secundario",
  },
};

async function confirmar({ titulo, texto, textoConfirmar }) {
  const { isConfirmed } = await Swal.fire({
    ...estilosModal,
    title: titulo,
    text: texto,
    icon: "question",
    showCancelButton: true,
    confirmButtonText: textoConfirmar,
    cancelButtonText: "Cancelar",
    reverseButtons: true,
  });
  return isConfirmed;
}

function mostrarProcesando() {
  Swal.fire({
    ...estilosModal,
    title: "Procesando el pago",
    text: "No cierres esta ventana.",
    allowOutsideClick: false,
    allowEscapeKey: false,
    showConfirmButton: false,
    didOpen: () => Swal.showLoading(),
  });
}

function mostrarError(titulo, texto) {
  return Swal.fire({
    ...estilosModal,
    title: titulo,
    text: texto,
    icon: "error",
    confirmButtonText: "Entendido",
  });
}

function mostrarComprobante({ numero, cliente, resumen, envio }) {
  const { nombre, email } = cliente;
  return Swal.fire({
    ...estilosModal,
    icon: "success",
    title: "¡Compra confirmada!",
    html: `
      <p class="comprobante-numero">Pedido <strong>${numero}</strong></p>
      <p>Gracias, ${escaparHtml(nombre)}. Te enviamos el detalle a
        <strong>${escaparHtml(email)}</strong>.</p>
      <p>Total pagado: <strong>${formatearPrecio(resumen.total)}</strong><br />
        ${escaparHtml(envio)}</p>`,
    confirmButtonText: "Seguir comprando",
  });
}

// ---------- Catálogo ----------

function renderEstadoCatalogo(contenedor, { mensaje, conReintento }) {
  contenedor.innerHTML = `
    <div class="estado">
      <p>${escaparHtml(mensaje)}</p>
      ${conReintento ? '<button class="btn" data-accion="reintentar">Reintentar</button>' : ""}
    </div>`;
}

function renderFiltrosCategoria(contenedor, categorias, activa) {
  contenedor.innerHTML = ["Todas", ...categorias]
    .map(
      (categoria) => `
      <button type="button" class="chip" data-accion="categoria"
        data-categoria="${categoria}" aria-pressed="${categoria === activa}">
        ${categoria}
      </button>`,
    )
    .join("");
}

function renderCatalogo(contenedor, productos, cantidadesEnCarrito) {
  if (productos.length === 0) {
    renderEstadoCatalogo(contenedor, {
      mensaje: "No encontramos productos con esos filtros.",
    });
    return;
  }

  contenedor.innerHTML = productos
    .map(({ id, nombre, categoria, precio, stock, imagen, descripcion }) => {
      const disponible = stock - (cantidadesEnCarrito[id] ?? 0);
      const textoStock =
        stock === 0
          ? "Sin stock"
          : stock <= UMBRAL_ULTIMAS_UNIDADES
            ? `¡Últimas ${stock} unidades!`
            : `${stock} disponibles`;
      return `
      <article class="tarjeta ${stock === 0 ? "sin-stock" : ""}">
        <img src="${imagen}" alt="${escaparHtml(nombre)}" loading="lazy" />
        <div class="tarjeta-cuerpo">
          <span class="etiqueta">${categoria}</span>
          <h3>${escaparHtml(nombre)}</h3>
          <p class="descripcion">${escaparHtml(descripcion)}</p>
          <p class="stock ${stock <= UMBRAL_ULTIMAS_UNIDADES ? "stock-bajo" : ""}">${textoStock}</p>
          <div class="tarjeta-pie">
            <span class="precio">${formatearPrecio(precio)}</span>
            <button class="btn" data-accion="agregar" data-id="${id}"
              ${disponible <= 0 ? "disabled" : ""}>
              ${stock === 0 ? "Agotado" : disponible <= 0 ? "En tu carrito" : "Agregar"}
            </button>
          </div>
        </div>
      </article>`;
    })
    .join("");
}

// ---------- Carrito ----------

function renderCarrito(contenedor, items) {
  contenedor.innerHTML =
    items.length === 0
      ? `<p class="vacio">Tu carrito está vacío.<br />Sumá productos del catálogo.</p>`
      : items
          .map(
            ({ id, nombre, precio, imagen, cantidad, stock }) => `
        <div class="item-carrito">
          <img src="${imagen}" alt="" />
          <div class="item-datos">
            <p class="item-nombre">${escaparHtml(nombre)}</p>
            <p class="item-precio">${formatearPrecio(precio * cantidad)}</p>
            <div class="cantidad" role="group" aria-label="Cantidad de ${escaparHtml(nombre)}">
              <button data-accion="restar" data-id="${id}" aria-label="Quitar una unidad">−</button>
              <span>${cantidad}</span>
              <button data-accion="sumar" data-id="${id}" aria-label="Sumar una unidad"
                ${cantidad >= stock ? "disabled" : ""}>+</button>
            </div>
          </div>
          <button class="btn-icono" data-accion="quitar" data-id="${id}"
            aria-label="Quitar ${escaparHtml(nombre)} del carrito">✕</button>
        </div>`,
          )
          .join("");
}

function renderTotalCarrito(elementos, { subtotal, unidades }) {
  elementos.total.textContent = formatearPrecio(subtotal);
  elementos.contador.textContent = unidades;
  elementos.btnContinuar.disabled = elementos.btnVaciar.disabled =
    unidades === 0;
}

// ---------- Checkout ----------

function renderOpcionesEnvio(contenedor, envios, envioActivo) {
  contenedor.innerHTML = envios
    .map(
      ({ id, nombre, detalle, costo }) => `
      <label class="opcion">
        <input type="radio" name="envio" value="${id}" ${id === envioActivo ? "checked" : ""} />
        <span class="opcion-texto"><strong>${nombre}</strong><small>${detalle}</small></span>
        <span class="opcion-costo">${costo === 0 ? "Gratis" : formatearPrecio(costo)}</span>
      </label>`,
    )
    .join("");
}

function renderOpcionesPago(selector, pagos, pagoActivo) {
  selector.innerHTML = pagos
    .map(
      ({ id, nombre }) =>
        `<option value="${id}" ${id === pagoActivo ? "selected" : ""}>${nombre}</option>`,
    )
    .join("");
}

function renderResumenCompra(contenedor, items, resumen, cuponActivo) {
  const { subtotal, descuentoCupon, costoEnvio, ajustePago, total } = resumen;
  const filas = items
    .map(
      ({ nombre, cantidad, precio }) => `
      <li><span>${cantidad} × ${escaparHtml(nombre)}</span>
        <span>${formatearPrecio(precio * cantidad)}</span></li>`,
    )
    .join("");

  contenedor.innerHTML = `
    <ul class="lista-resumen">${filas}</ul>
    <dl class="totales">
      <div><dt>Subtotal</dt><dd>${formatearPrecio(subtotal)}</dd></div>
      ${
        cuponActivo
          ? `<div class="descuento"><dt>Cupón ${cuponActivo.codigo}</dt>
              <dd>−${formatearPrecio(descuentoCupon)}</dd></div>`
          : ""
      }
      <div><dt>Envío</dt><dd>${costoEnvio === 0 ? "Gratis" : formatearPrecio(costoEnvio)}</dd></div>
      ${
        ajustePago !== 0
          ? `<div class="descuento"><dt>Ajuste por forma de pago</dt>
              <dd>${ajustePago < 0 ? "−" : "+"}${formatearPrecio(Math.abs(ajustePago))}</dd></div>`
          : ""
      }
      <div class="total-final"><dt>Total</dt><dd>${formatearPrecio(total)}</dd></div>
    </dl>`;
}

function mostrarErroresFormulario(formulario, errores) {
  formulario.querySelectorAll("[data-error-de]").forEach((mensaje) => {
    const texto = errores[mensaje.dataset.errorDe] ?? "";
    mensaje.textContent = texto;
    formulario.elements[mensaje.dataset.errorDe]?.setAttribute(
      "aria-invalid",
      texto !== "",
    );
  });
}

// ---------- Pedidos ----------

function renderPedidos(contenedor, pedidos) {
  if (pedidos.length === 0) {
    contenedor.innerHTML = `
      <div class="estado">
        <p><strong>Aún no tenés pedidos.</strong><br />Cuando confirmes una compra, la vas a ver acá.</p>
        <button type="button" class="btn" data-nav="tienda">Ir a la tienda</button>
      </div>`;
    return;
  }

  contenedor.innerHTML = pedidos
    .map(({ numero, fecha, items, resumen, envio, pago }) => {
      const detalle = items
        .map(
          ({ nombre, cantidad, precio }) =>
            `<li>${cantidad} × ${escaparHtml(nombre)} <span>${formatearPrecio(precio * cantidad)}</span></li>`,
        )
        .join("");
      return `
      <article class="pedido">
        <header>
          <div>
            <h3>${numero}</h3>
            <p>${formatearFecha(fecha)}</p>
          </div>
          <strong class="pedido-total">${formatearPrecio(resumen.total)}</strong>
        </header>
        <ul class="pedido-detalle">${detalle}</ul>
        <p class="pedido-meta">${escaparHtml(envio)} · ${escaparHtml(pago)}</p>
        <button class="btn btn-peligro" data-accion="eliminar-pedido" data-numero="${numero}">
          Eliminar pedido
        </button>
      </article>`;
    })
    .join("");
}

// ---------- Cupón ----------

function renderEstadoCupon(contenedor, cupon) {
  contenedor.innerHTML = cupon
    ? `<span class="cupon-activo">✓ ${cupon.codigo}: ${cupon.detalle}</span>
       <button type="button" class="enlace" data-accion="quitar-cupon">Quitar</button>`
    : "";
}
