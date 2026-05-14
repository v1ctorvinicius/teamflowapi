// src/modules/product/product.controller.ts
import type { FastifyRequest, FastifyReply } from "fastify";
import type { ProductsService } from "./product.service.ts";
import type { ProductFilters } from "./product.types.ts";
import type { ShirtSize, ShirtType } from "../../shared/types.ts";

function toPublicProduct(product: any) {
  const { supplierMetadata: _, ...pub } = product;
  return pub;
}

interface ListQuery {
  page?: number;
  limit?: number;
  club?: string;
  brand?: string;
  type?: ShirtType;
  gender?: 'MASCULINE' | 'FEMININE' | 'UNISEX';
  sizeCategorical?: ShirtSize;
  sizeNumeric?: string;
  season?: string;
  minPrice?: number;
  maxPrice?: number;
}

export class ProductsController {
  constructor(private service: ProductsService) {}

  async list(
    request: FastifyRequest<{ Querystring: ListQuery }>,
    reply: FastifyReply,
  ) {
    try {

      const { 
        page = 1, 
        limit = 20, 
        club, 
        brand,
        type, 
        gender,
        sizeCategorical,
        sizeNumeric,
        season,
        minPrice,
        maxPrice,
      } = request.query;


      const filters: ProductFilters = {
        page: Number(page),
        limit: Number(limit),
        ...(club && { club }),
        ...(brand && { brand }),
        ...(type && { type }),
        ...(gender && { gender }),
        ...(sizeCategorical && { sizeCategorical }),
        ...(sizeNumeric && { sizeNumeric }),
        ...(season && { season }),
        ...(minPrice !== undefined && { minPrice: minPrice }),
        ...(maxPrice !== undefined && { maxPrice: maxPrice }),
      };

      const result = await this.service.listProducts(filters);


      let dataArray = [];
      if (Array.isArray(result.data)) {
        dataArray = result.data;
      } else if (result.data && typeof result.data === "object") {
        dataArray = [result.data];
      }

      const publicData = dataArray.map(toPublicProduct);

      return reply.status(200).send({
        data: publicData,
        pagination: result.pagination || {
          page: filters.page,
          limit: filters.limit,
          total: dataArray.length,
          totalPages: 1,
        },
      });
    } catch (error) {
      console.error("Error in list controller:", error);
      return reply.status(500).send({
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  async get(
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply,
  ) {
    try {
      const product = await this.service.getProduct(request.params.id);
      return reply.status(200).send({ data: toPublicProduct(product) });
    } catch (error) {
      console.error("Error in get controller:", error);
      if (error.message === "Product not found") {
        return reply.status(404).send({ error: "Product not found" });
      }
      return reply.status(500).send({
        error: "Internal server error",
        message: error.message,
      });
    }
  }

  async validatePersonalization(
    request: FastifyRequest<{
      Params: { id: string };
      Body: { name?: string; number?: number };
    }>,
    reply: FastifyReply,
  ) {
    try {
      const result = await this.service.validatePersonalization(
        request.params.id,
        request.body,
      );
      return reply.status(200).send({ data: result });
    } catch (error) {
      console.error("Error in validatePersonalization:", error);
      return reply.status(500).send({
        error: "Internal server error",
        message: error.message,
      });
    }
  }
}