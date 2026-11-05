export interface Produto {
  id?: number;
  nome: string;
  vendedor_pessoa: string;
  chave_pix?: string | null;
  preco_padrao: number;
  criado_em?: string;
}
