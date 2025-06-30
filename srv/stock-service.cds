using { my.stock as stock } from '../db/schema';

type StockResult : {
  ID : UUID;
  material : String;
  quantity : Integer;
  storageLocation : String;
};

service StockService {
  entity MaterialStock as projection on stock.MaterialStock;
  function checkStock() returns array of MaterialStock;
}