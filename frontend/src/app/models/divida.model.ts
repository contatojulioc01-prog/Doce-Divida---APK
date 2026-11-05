export interface HistoricoPagamento {
  id?: number;
  divida_id: number;
  valor_pago: number;
  quantidade_paga?: number;
  data_pagamento: string;
  observacao?: string | null;
  comprovante_base64?: string | null;
  comprovante_nome?: string | null;
  comprovante_tipo?: string | null; // 'imagem' | 'pdf'
  criado_em?: string;
}

export interface Divida {
  id?: number;
  produto_id?: number | null;
  descricao: string;
  vendedor_pessoa: string;
  chave_pix?: string | null;
  quantidade: number;
  quantidade_paga?: number;
  valor_unitario?: number;
  valor: number;
  valor_pago?: number;
  data_lancamento: string;
  pago: boolean;
  observacao?: string | null;
  comprovante_base64?: string | null;
  comprovante_nome?: string | null;
  comprovante_tipo?: string | null; // 'imagem' | 'pdf'
  criado_em?: string;
  produto_nome?: string;
  historico_pagamentos?: HistoricoPagamento[];
}

export interface GrupoDivida {
  chave: string;
  descricao: string;
  vendedor_pessoa: string;
  chave_pix?: string | null;
  produto_id?: number | null;
  valor_unitario?: number;
  total_pedidos: number;
  total_quantidade: number;
  total_quantidade_paga: number;
  total_quantidade_pendente: number;
  total_valor_pendente: number;
  total_valor_pago: number;
  total_valor_geral: number;
  todos_pagos: boolean;
  parcialmente_pago: boolean;
  expandido: boolean;
  itens: Divida[];
}

export interface TotaisDividas {
  total_pendente: number;
  total_pago: number;
  total_geral: number;
  qtd_pendente: number;
  qtd_pago: number;
  qtd_total: number;
  qtd_unidades_pendentes?: number;
  qtd_unidades_pagas?: number;
}
