import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return { message: "Configuración page coming soon" };
};

export default function Configuracion() {
  return (
    <s-page heading="Configuración">
      <s-section>
        <s-card>
          <s-stack gap="base" alignment="center">
            <s-heading size="medium">⚙️ En Construcción</s-heading>
            <s-text>Esta sección estará disponible pronto</s-text>
            <s-text subdued>
              Aquí podrás configurar usuarios, permisos, integraciones y preferencias de la app.
            </s-text>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}