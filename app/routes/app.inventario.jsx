import { useState } from "react";
import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { admin } = await authenticate.admin(request);
  return { message: "Inventario page coming soon" };
};

export default function Inventario() {
  return (
    <s-page heading="Gestión de Inventario">
      <s-section>
        <s-card>
          <s-stack gap="base" alignment="center">
            <s-heading size="medium">🚧 En Construcción</s-heading>
            <s-text>Esta sección estará disponible pronto</s-text>
            <s-text subdued>
              Aquí podrás gestionar el inventario global, transferencias entre sucursales y más.
            </s-text>
          </s-stack>
        </s-card>
      </s-section>
    </s-page>
  );
}