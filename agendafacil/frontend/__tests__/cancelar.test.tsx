import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Cancelar from '@/app/cancelar/[codigo]/page';
import { localParaUTC } from '@/lib/api';

jest.mock('next/navigation', () => ({ useParams: () => ({ codigo: 'AF7K92XQ' }) }));

const agendamento = {
  codigo: 'AF7K92XQ', status: 'CONFIRMADO', dataHora: '2026-10-15T17:00:00.000Z',
  servico: { nome: 'Corte masculino' }, profissional: { nome: 'Rafael' }, estabelecimento: { nome: 'Barbearia Souza', slug: 'barbearia-souza' },
};

// jsdom não traz fetch/Response: usamos um fetch falso com o mínimo que o cliente de API usa.
const resposta = (corpo: unknown, status = 200) => ({ ok: status < 400, status, json: async () => corpo });
const fetchMock = jest.fn();
beforeEach(() => { fetchMock.mockReset(); (global as unknown as { fetch: unknown }).fetch = fetchMock; });

describe('/cancelar/[codigo]', () => {
  it('mostra os dados e cancela ao confirmar', async () => {
    fetchMock.mockImplementation(async (_url: string, init?: RequestInit) =>
      resposta(init?.method === 'PATCH' ? { ...agendamento, status: 'CANCELADO' } : agendamento));
    render(<Cancelar />);
    expect(await screen.findByText('Barbearia Souza')).toBeInTheDocument();
    expect(screen.getByText(/Corte masculino com Rafael/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar agendamento' }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Agendamento cancelado' })).toBeInTheDocument());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('exibe o erro quando o código não existe', async () => {
    fetchMock.mockResolvedValue(resposta({ error: 'NOT_FOUND', message: 'Agendamento não encontrado' }, 404));
    render(<Cancelar />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Agendamento não encontrado');
  });
});

describe('localParaUTC', () => {
  it('converte horário de Maceio (UTC-3) para UTC', () => {
    expect(localParaUTC('2026-10-15', '14:00', 'America/Maceio')).toBe('2026-10-15T17:00:00.000Z');
  });
});
